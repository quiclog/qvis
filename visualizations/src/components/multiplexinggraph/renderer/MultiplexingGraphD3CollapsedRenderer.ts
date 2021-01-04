import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@/data/QlogSchema';
import StreamGraphDataHelper from './MultiplexingGraphDataHelper';
import MultiplexingGraphD3ByterangesRenderer from './MultiplexingGraphD3ByterangesRenderer';
import MultiplexingGraphD3WaterfallRenderer from './MultiplexingGraphD3WaterfallRenderer';


interface StreamRange {
    currentHead:number, // up to and including where the stream has been moved to the HTTP layer
    highestReceived:number, // up to where the stream has been received (with holes between currentHead and this if they're not equal)
    holes:Array<Range>,
    filled:Array<Range>,

    cumulativeTimeDifference:number,
    timeDifferenceSampleCount:number,

    frameCount:number,
}

interface Range {
    time: number,
    from: number,
    to: number
}

enum FrameArrivalType {
    Normal,
    Future,
    Duplicate,
    Retransmit,
    Reordered,
    UNKNOWN,
}

interface ArrivalInfo {
    type: FrameArrivalType,
    timeDifference: number,
    createdHole:Array<number>|undefined
}

export default class MultiplexingGraphD3CollapsedRenderer {

    public containerID:string;
    public axisLocation:"top"|"bottom" = "bottom";

    public byteRangeRenderer!:MultiplexingGraphD3ByterangesRenderer;
    public waterfallRenderer:MultiplexingGraphD3WaterfallRenderer|undefined = undefined; // set from outside. FIXME: dirty!

    // public svgID:string;
    public rendering:boolean = false;

    protected svg!:any;
    protected tooltip!:any;
    protected connection!:QlogConnection;

    protected barHeight = 70;

    protected currentDomain:any = undefined;

    private dimensions:any = {};

    constructor(containerID:string, byteRangeContainerID:string) {
        this.containerID = containerID;

        this.byteRangeRenderer = new MultiplexingGraphD3ByterangesRenderer(byteRangeContainerID);
    }
   
    public async render(connection:QlogConnection):Promise<boolean> {
        if ( this.rendering ) {
            return false;
        }

        console.log("MultiplexingGraphD3CollapsedRenderer:render", connection);

        this.rendering = true;

        const canContinue:boolean = this.setup(connection);

        if ( !canContinue ) {
            this.rendering = false;

            return false;
        }

        await this.renderLive();
        this.rendering = false;

        return true;
    }

    protected setup(connection:QlogConnection){
        this.connection = connection;
        this.connection.setupLookupTable();

        const container:HTMLElement = document.getElementById(this.containerID)!;

        this.dimensions.margin = {top: 0, right: 40, bottom: 20, left: 20};
        // this.dimensions.margin = {top: 0, right: (this.waterfallRenderer as any).dimensions.margin.right, bottom: 20, left: 20};
        if ( this.axisLocation === "top" ){
            this.dimensions.margin.top = 20;
        }
        else {
            this.dimensions.margin.bottom = 40;
        }

        // width and height are the INTERNAL widths (so without the margins)
        this.dimensions.width = container.clientWidth - this.dimensions.margin.left - this.dimensions.margin.right;
        this.dimensions.height = this.barHeight;


        // clear old rendering
        d3.select( "#" + this.containerID ).selectAll("*").remove();

        this.svg = d3.select("#" + this.containerID)
            .append("svg")
                .attr("width", this.dimensions.width + this.dimensions.margin.left + this.dimensions.margin.right)
                .attr("height", this.dimensions.height + this.dimensions.margin.top + this.dimensions.margin.bottom)
                // .attr("viewBox", [0, 0, this.dimensions.width, this.dimensions.height])
                .attr("xmlns", "http://www.w3.org/2000/svg")
                .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
                .attr("font-family", "Trebuchet-ms")
            .append("g")
                .attr("transform",
                    "translate(" + this.dimensions.margin.left + "," + this.dimensions.margin.top + ")");

        this.tooltip = d3.select("#multiplexing-packet-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("padding", "5px")
            .style("pointer-events", "none") // crucial! 
            .style("background", "lightsteelblue");

        // this.svg.append("text")
        //     .attr("x", 0)
        //     .attr("y", (this.barHeight / 2))
        //     .attr("dominant-baseline", "central")
        //     .style("text-anchor", "end")
        //     .style("font-size", "12")
        //     .style("font-family", "Trebuchet MS")
        //     .style("font-style", "italic")
        //     .attr("fill", "#000000")
        //     .text("" + "COLLAPSED");

        return true;
    }

    protected async renderLive() {
        console.log("Rendering multiplexinggraph");

        const parser = this.connection.getEventParser();

        // want total millisecond range in this trace, so last - first
        const xMSRange = parser.load(this.connection.getEvents()[ this.connection.getEvents().length - 1 ]).absoluteTime - 
                       parser.load(this.connection.getEvents()[0]).absoluteTime;

        console.log("DEBUG MS range for this trace: ", xMSRange);

        let frameCount = 1;
        let packetIndex = 0;
        const streamIDs:Set<number> = new Set<number>();


        // clients receive data, servers send it
        let eventType = qlog.TransportEventType.packet_received;
        let directionText = "received";
        if ( this.connection.vantagePoint && this.connection.vantagePoint.type === qlog.VantagePointType.server ){
            eventType = qlog.TransportEventType.packet_sent;
            directionText = "sent";
        }

        // const packets = this.connection.lookup( qlog.EventCategory.transport, eventType );


        //         filled[0]                holes[0] filled[1] holes[1]   filled[2]
        // .../////////////////////////////| _____ |/////////| _______ |/////////////|
        //                                 ^                                         ^
        //                           currentHead                               highestReceived


        // we want to keep track of the filled ranges but also the holes and then especially: when those holes become filled! 
        // if it takes a long time for a hole to become filled, it indicates a retransmit. A short time indicates a re-order. 
        const streamRanges:Map<number, StreamRange> = new Map<number, StreamRange>();

        // approach: only tracking holes gives a difficult algorithm in practice (I tried...)
        // so, we do it differently: we keep track of the filled ranges and generate the holes from that on each step
        // we track the timestamps between the new holes and the old holes
        const calculateFrameArrivalType = (range:StreamRange, timestamp:number, from:number, to:number):ArrivalInfo => {

            // console.log("TIMESTAMP: ", timestamp, from, to, range.currentHead, range.highestReceived);

            // step 1: find hole where this new frame fits (if none found: this is a new packet: either Normal or Future!)
            // step 2: add frame to filled list
            // step 3: generate holes from filled list, backfilling the timestamps from the old holes

            let outputType = FrameArrivalType.UNKNOWN;
            let outputTimestampDifference = 0;
            let outputHole:Range|undefined = undefined;

            // 1.
            let foundHole:Range|undefined = undefined;
            for ( const hole of range.holes ) {
                // ignore if we overlap 2 holes for now
                if ( (from >= hole.from && from <= hole.to) || 
                     (to   >= hole.from && to   <= hole.to) ) {

                    foundHole = hole;
                    break;
                }
            }

            if ( !foundHole ) {

                // just checking to < range.currentHead only finds overlaps in the past
                // if we are having spurious retransmits between currentHead and highestReceived, they are found by checking overlaps in filled instead 
                let foundFilled:Range|undefined = undefined;
                for ( const filled of range.filled ) {
                    if ( (from >= filled.from && from <= filled.to) || 
                         (to   >= filled.from && to   <= filled.to) ) {
    
                        foundFilled = filled;
                        break;
                    }
                }

                if ( foundFilled ) {
                    console.error("DUPLICATE FOUND VIA FILLED!", foundFilled, from, to);

                    return { type: FrameArrivalType.Duplicate, timeDifference: 0, createdHole: undefined };
                }
                else if ( to < range.currentHead ) {
                    // total duplicate, no need to update state
                    // alert("DUPLICATE FOUND!" + from + "->" + to); // never happened in our tests
                    console.error("calculateFrameArrivalType : duplicate data found! Not really an error, but means spurious retransmissions.", range.currentHead, from, to, timestamp);

                    return { type: FrameArrivalType.Duplicate, timeDifference: 0, createdHole: undefined };
                }
                else if ( from > range.highestReceived + 1 ) { // creates a hole
                    outputType = FrameArrivalType.Future;

                    outputHole = { time: timestamp, from: range.highestReceived + 1, to: from };
                }
                else if ( from === range.highestReceived + 1 ){ // normal, everything arrives in-order without gaps
                    outputType = FrameArrivalType.Normal;
                }
                else if ( to > range.highestReceived + 1 ) {
                    // partial overlap at the end: from is < highestReceived, to is > : mark this as "normal" for now
                    outputType = FrameArrivalType.Normal;
                }
                else {
                    // 2 options: 
                    //  a) range "spans" a hole (starts overlapping with 1 filled, then covers hole, then ends in another filled)
                    //  b) unknown situation we haven't seen before

                    // a)
                    // filled is sorted by .from, lowest to highest
                    let spanning = false;
                    for ( let i = 0; i < range.filled.length - 1; ++i ){
                        const filled1 = range.filled[i];
                        const filled2 = range.filled[i + 1];

                        if ( from >= filled1.from && to > filled1.to &&
                             to <= filled2.to ) {
                                spanning = true;
                             }
                    }

                    if ( spanning ){
                        foundHole = undefined;
                        for ( const hole of range.holes ) {
                            // look for the hole we're spanning
                            if ( (from < hole.from && to > hole.to) ) {
                                foundHole = hole;
                                break;
                            }
                        }

                        if ( foundHole ){
                            console.error("Found spanning frame, shouldn't happen in practice, only when debugging", foundHole, from, to, range);
                            outputTimestampDifference = timestamp - foundHole.time;
                            outputType = FrameArrivalType.Retransmit;
                        }
                        else {
                            console.error("calculateFrameArrivalType: Spanning frame, but not hole found... very weird", from, to, range);
                            outputType = FrameArrivalType.UNKNOWN;
                        }
                    }
                    else {
                        console.error("calculateFrameArrivalType: no hole found for frame, but also nowhere else we would expect it...", from, to, range);
                        outputType = FrameArrivalType.UNKNOWN;
                    }
                }
            }
            else {
                outputTimestampDifference = timestamp - foundHole.time;
                outputType = FrameArrivalType.Retransmit;
            }

            if ( outputType === FrameArrivalType.Retransmit ){
                // TODO: maybe only decide it's a re-order if it fits perfectly in a hole? 
                ++range.timeDifferenceSampleCount;
                range.cumulativeTimeDifference += outputTimestampDifference;

                const avg = range.cumulativeTimeDifference / range.timeDifferenceSampleCount;
                if ( outputTimestampDifference < 20 && outputTimestampDifference < avg * 0.3 ) { // lower than 20ms and within 30% of the current RTT estimate is -probably- reorder
                    outputType = FrameArrivalType.Reordered;

                    // console.log("REORDERED PACKET FOUND", foundHole, from, to, outputTimestampDifference, avg);
                }
                // else {
                //     console.log("RETRANSMITTED PACKET FOUND", foundHole, from, to, outputTimestampDifference, avg);
                // }
            }

            if ( to > range.highestReceived ) {
                range.highestReceived = to;
            }

            // 2.
            // https://www.geeksforgeeks.org/merging-intervals/
            // https://algorithmsandme.com/arrays-merge-overlapping-intervals/
            range.filled.push ( {from: from, to: to, time: timestamp} );
            range.filled.sort( (a:Range, b:Range):number => {
                return a.from - b.from;
            }); // ascending order, just the way we like it

            const stack = new Array<Range>();
            stack.push( range.filled[0] );

            for ( let i = 1; i < range.filled.length; ++i ){

                const previousInterval = stack.pop();
                const currentInterval = range.filled[i];


                // If current interval's start time is less than end time of
                // previous interval, find max of end times of two intervals
                // and push new interval on to stack.
                if ( previousInterval!.to + 1 >= currentInterval.from ) {
                    const endTime = Math.max( previousInterval!.to, currentInterval.to );
                    stack.push ( { from: previousInterval!.from, to : endTime, time: timestamp } );
                }
                else {
                    stack.push ( previousInterval! );
                    stack.push ( currentInterval );
                }
            }

            range.filled = stack; // should also be sorted now!

            // console.log( "filled ranges are now ", JSON.stringify(range.filled) );


            // 3.
            const newHoles:Array<Range> = new Array<Range>();

            for ( let i = 0; i < range.filled.length - 1; ++i ) {
                const filled1 = range.filled[i];
                const filled2 = range.filled[i + 1];

                const newHole = { from: filled1.to + 1, to: filled2.from - 1, time: -666 };

                let foundHole2:Range|undefined = undefined;

                for ( const hole of range.holes ) {
                    // ignore if we overlap 2 holes for now
                    if ( (newHole.from >= hole.from && newHole.from <= hole.to) || 
                         (newHole.to   >= hole.from && newHole.to   <= hole.to) ) {
                            
                        foundHole2 = hole;
                        break;
                    }
                }

                if ( foundHole2 ){
                    newHole.time = foundHole2.time;
                }
                else {
                    newHole.time = timestamp; // new hole due to a future frame
                }
                
                newHoles.push ( newHole );
            }

            range.holes = newHoles;

            if ( range.holes.length > 0 ) {
                range.currentHead = range.holes[0].from - 1;
            }
            else {
                range.currentHead = range.filled[ range.filled.length - 1 ].to;
            }

            // console.log("Ended arrival algorithm ", FrameArrivalType[outputType], outputTimestampDifference, range.currentHead, range.highestReceived, range.holes, range.filled );
            // console.log("--------------------------------------");

            return { type: outputType, timeDifference: outputTimestampDifference, createdHole: ((outputHole !== undefined) ? [outputHole.from, outputHole.to] : undefined) };
        };

        const dataSent:Array<any> = [];
        const dataMoved:Array<any> = [];
        for ( const eventRaw of this.connection.getEvents() ) {

            const event = this.connection.parseEvent( eventRaw );
            const data = event.data;

            if ( event.name === eventType ){ // packet_sent or _received, the ones we want to plot

                const streamFrames = new Array<any>();

                if ( data.frames && data.frames.length > 0 ){
                    for ( const frame of data.frames ) {

                        if ( frame.stream_id === undefined || !StreamGraphDataHelper.isDataStream( "" + frame.stream_id )){
                            // skip control streams like QPACK
                            continue;
                        }

                        const streamID = parseInt( frame.stream_id, 10 );

                        if ( frame.frame_type && frame.frame_type === qlog.QUICFrameTypeName.stream ){

                            streamFrames.push ( frame );

                            let ranges = streamRanges.get( streamID );
                            if ( !ranges ){
                                ranges = 
                                {currentHead:-1, highestReceived: -1, holes: new Array<Range>(), filled:new Array<Range>(), cumulativeTimeDifference: 0, timeDifferenceSampleCount: 0, frameCount: 0 };
                                streamRanges.set( streamID, ranges );
                            }

                            const arrivalInfo:ArrivalInfo = 
                                calculateFrameArrivalType(ranges, event.relativeTime, parseInt(frame.offset, 10), parseInt(frame.offset, 10) + parseInt(frame.length, 10) - 1 );

                            ranges.frameCount += 1;

                            
                            dataSent.push( {
                                streamID: streamID, 
                                packetNumber: data.header.packet_number,
                                index: packetIndex, 
                                size: frame.length, 
                                countStart: frameCount, 
                                countEnd: frameCount + 1,

                                arrivalType: arrivalInfo.type, 
                                arrivalTimeDifference: arrivalInfo.timeDifference,
                                arrivalCreatedHole: arrivalInfo.createdHole,

                                offset: parseInt(frame.offset, 10),
                                length: parseInt(frame.length, 10),
                                time: event.relativeTime,
                            });

                            ++frameCount;
                            ++packetIndex;

                            streamIDs.add( streamID );
                        }
                    }
                }
            }
            else if ( event.name === qlog.HTTP3EventType.data_moved ) {

                if ( !StreamGraphDataHelper.isDataStream( "" + data.stream_id )){
                    continue;
                }

                if ( data.from !== "transport" && data.to !== "application") { // only dealing with data bubbling up from the transport at the moment 
                    continue;
                }

                if ( dataSent.length === 0 ) {
                    console.error("data moved but no stream frames seen yet... shouldn't happen!", data);
                    continue;
                }

                const movedOffset = parseInt( data.offset, 10 );
                const movedLength = parseInt( data.length, 10 );

                if ( movedLength === 0 ) {
                    console.error("data_moved event with length 0, shouldn't happen! ignoring...", data);
                    continue;
                }

                // can't simply say dataSent[ dataSent.length - 1 ] is the STREAM frame we need, because multiple STREAM frames of different streams could be in a single packet
                // as such, find the last STREAM frame of the stream the data_moved belongs to
                // NOTE: if you e.g., have 15 small STREAM frames of the same stream in one packet (which is possible, but a bit odd)
                // then this won't be 100% accurate, as the first data_moved was probably triggered by the first STREAM frame, not the 15th, though here we find the 15th
                // we had older versions of this code looking for that, but the benefits didn't outweight the complexity in the end. 
                let foundFrame = undefined;
                for ( let i = dataSent.length - 1; i >= 0; --i ) {
                    if ( "" + dataSent[i].streamID === "" + data.stream_id ) {
                        foundFrame = dataSent[i];
                        break;
                    }
                }

                if ( !foundFrame ) {
                    console.error("Data moved but didn't start at previous stream's offset, impossible!!!", foundFrame, event.relativeTime, data);
                    continue;
                }

                dataMoved.push({
                    streamID: parseInt(data.stream_id, 10),
                    countStart: foundFrame.countStart,
                    countEnd: foundFrame.countEnd,
                    offset: movedOffset,
                    length: movedLength,
                });
            }
        }

        for ( const [stream_id, range] of streamRanges ) {
            if ( range.holes && range.holes.length !== 0 ) {
                console.warn("MultiplexingGraphD3CollapsedRenderer : stream has holes, didn't finish completely! Did this connection end pre-maturely?", stream_id, range.holes);
            }
        }

        // console.log("IDs present ", dataSent.map( (d) => d.streamID).filter((item, i, ar) => ar.indexOf(item) === i));

        const clip = this.svg.append("defs").append("SVG:clipPath")
            .attr("id", "clip")
            .append("SVG:rect")
            .attr("width", this.dimensions.width )
            .attr("height", this.dimensions.height )
            .attr("x", 0 )
            .attr("y", 0);

        const rects = this.svg.append('g')
            .attr("clip-path", "url(#clip)");

        // if ( streamIDs.size <= 1 || frameCount < 5 ){
        //     rects
        //     // text
        //     .append("text")
        //         .attr("x", 200 )
        //         .attr("y", 30 ) // + 1 is eyeballed magic number
        //         .attr("dominant-baseline", "baseline")
        //         .style("text-anchor", "start")
        //         .style("font-size", "14")
        //         .style("font-family", "Trebuchet MS")
        //         // .style("font-weight", "bold")
        //         .attr("fill", "#000000")
        //         .text( "This trace doesn't contain multiple independent streams (or has less than 5 STREAM frames), which is needed for this visualization." );

        //     return;
        // }


        const packetSidePadding = 0.3;

        const xDomain = d3.scaleLinear()
            .domain([1, frameCount])
            .range([ 0, this.dimensions.width ]);

        this.currentDomain = xDomain;

        const xAxis = this.svg.append("g");
        
        if ( this.axisLocation === "top" ) {
            xAxis
                // .attr("transform", "translate(0," + this.dimensions.height + ")")
                .call(d3.axisTop(xDomain));
        }
        else {
            xAxis
                .attr("transform", "translate(0," + this.dimensions.height + ")")
                .call(d3.axisBottom(xDomain));
        }

        // https://bl.ocks.org/d3noob/a22c42db65eb00d4e369
        const packetMouseOver = (data:any, index:number) => {

            this.tooltip.transition()
                .duration(100)
                .style("opacity", .95);

            let text = "";
            text += data.time + "ms : stream " + data.streamID + " : packet number " + data.packetNumber + "<br/>";
            text += "[" + data.offset + ", " + (data.offset + data.length - 1) + "] (size: " + data.length + ")";
            if ( data.arrivalType === FrameArrivalType.Retransmit || data.arrivalType === FrameArrivalType.Reordered ) {
                text += "<br/>";
                text += "Fills gap that was created " + data.arrivalTimeDifference + "ms ago";
            }
            else if ( data.arrivalCreatedHole !== undefined ){
                text += "<br/>";
                text += "Creates gap from " + data.arrivalCreatedHole[0] + " to " + data.arrivalCreatedHole[1] + " (size: " + (data.arrivalCreatedHole[1] - data.arrivalCreatedHole[0]) + ")";
            }

            this.tooltip
                .html( text )
                .style("left", (d3.event.pageX + 15) + "px")
                .style("top", (d3.event.pageY - 75) + "px");
        };

        const packetMouseOut = (data:any, index:number) => {

            this.tooltip.transition()		
                .duration(200)		
                .style("opacity", 0);	
        };

        const packetHeight = this.barHeight * 0.65;
        const typeGap = this.barHeight * 0.05;
        const typeHeight = this.barHeight * 0.275;

        rects
            .selectAll("rect.packet")
            .data(dataSent)
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(d.countStart) - packetSidePadding )
                .attr("y", (d:any) => (d.index % 2 === 0 ? 0 : packetHeight * 0.05) )
                .attr("fill", (d:any) => StreamGraphDataHelper.StreamIDToColor("" + d.streamID)[0] /*"" + colorDomain( "" + d.streamID )*/ )
                .style("opacity", 1)
                .attr("class", "packet")
                .attr("width", (d:any) => xDomain(d.countEnd) - xDomain(d.countStart) + packetSidePadding * 2)
                .attr("height", (d:any) => packetHeight * (d.index % 2 === 0 ? 1 : 0.90))
                .style("pointer-events", "all")
                .on("mouseover", packetMouseOver)
                .on("mouseout", packetMouseOut)
                .on("click", (d:any) => { this.byteRangeRenderer.render(dataSent, dataMoved, d.streamID); this.byteRangeRenderer.zoom( this.currentDomain ); });

        rects
            .selectAll("rect.retransmitPacket")
            .data( dataSent.filter( (d:any) => { return d.arrivalType === FrameArrivalType.Retransmit; } ) )
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(d.countStart) - packetSidePadding )
                .attr("y", (d:any) => packetHeight + typeGap )
                .attr("fill", (d:any) => "black" )
                .style("opacity", 1)
                .attr("class", "retransmitPacket")
                .attr("width", (d:any) => xDomain(d.countEnd) - xDomain(d.countStart) + packetSidePadding * 2)
                .attr("height", (d:any) => typeHeight);

        
        rects
            .selectAll("rect.reorderPacket")
            .data( dataSent.filter( (d:any) => { return d.arrivalType === FrameArrivalType.Reordered; } ) )
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(d.countStart) - packetSidePadding )
                .attr("y", (d:any) => packetHeight + typeGap )
                .attr("fill", (d:any) => "blue" )
                .style("opacity", 1)
                .attr("class", "reorderPacket")
                .attr("width", (d:any) => xDomain(d.countEnd) - xDomain(d.countStart) + packetSidePadding * 2)
                .attr("height", (d:any) => typeHeight);

        rects
            .selectAll("rect.duplicatePacket")
            .data( dataSent.filter( (d:any) => { return d.arrivalType === FrameArrivalType.Duplicate; } ) )
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(d.countStart) - packetSidePadding )
                .attr("y", (d:any) => packetHeight + typeGap )
                .attr("fill", (d:any) => "red" )
                .style("opacity", 1)
                .attr("class", "duplicatePacket")
                .attr("width", (d:any) => xDomain(d.countEnd) - xDomain(d.countStart) + packetSidePadding * 2)
                .attr("height", (d:any) => typeHeight);


        rects
            .selectAll("rect.futurePacket")
            .data( dataSent.filter( (d:any) => { return d.arrivalType === FrameArrivalType.Future; } ) )
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(d.countStart) - packetSidePadding )
                .attr("y", (d:any) => packetHeight + typeGap )
                .attr("fill", (d:any) => "purple" )
                .style("opacity", 1)
                .attr("class", "futurePacket")
                .attr("width", (d:any) => xDomain(d.countEnd) - xDomain(d.countStart) + packetSidePadding * 2)
                .attr("height", (d:any) => typeHeight);

        // legend
        this.svg.append('g')
            // text
            .append("text")
                .attr("x", xDomain(frameCount / 2) )
                .attr("y", this.dimensions.height + this.dimensions.margin.bottom - 10 ) // + 1 is eyeballed magic number
                .attr("dominant-baseline", "baseline")
                .style("text-anchor", "middle")
                .style("font-size", "14")
                .style("font-family", "Trebuchet MS")
                // .style("font-weight", "bold")
                .attr("fill", "#000000")
                .text( "Count of STREAM frames " + directionText + " (regardless of size, includes retransmits)" ); 

        const updateChart = () => {

            // recover the new scale
            const newX = d3.event.transform.rescaleX(xDomain);

            this.currentDomain = newX;

            // update axes with these new boundaries
            // xAxis./*transition().duration(200).*/call(d3.axisBottom(newX));
            if ( this.axisLocation === "top" ){
                xAxis.call(d3.axisTop(newX));
            }
            else {
                xAxis.call(d3.axisBottom(newX));
            }

            // update position
            rects
                .selectAll(".packet,.retransmitPacket,.reorderPacket,.duplicatePacket,.futurePacket")
                // .transition().duration(200)
                .attr("x", (d:any) => newX(d.countStart) - packetSidePadding )
                // .attr("y", (d:any) => { return 50; } )
                .attr("width", (d:any) => newX(d.countEnd) - newX(d.countStart) + packetSidePadding * 2)

            this.byteRangeRenderer.zoom( newX );
        };
        
        const zoom = d3.zoom()
            .scaleExtent([1, 30])  // This control how much you can unzoom (x0.5) and zoom (x20)
            .translateExtent([[0, 0], [this.dimensions.width, this.dimensions.height]])
            .extent([[0, 0], [this.dimensions.width, this.dimensions.height]])
            .on("zoom", updateChart);
        
        this.svg.call(zoom);

        if ( dataSent.length > 0 ) {
            this.byteRangeRenderer.render( dataSent, dataMoved, 0 );
        }


        // make sure that if someone clicks on the waterfall renderer, it also updates the byteRangeRenderer
        if ( this.waterfallRenderer !== undefined ){
            this.waterfallRenderer.onStreamClicked = (streamID:string) => {
                if ( this.byteRangeRenderer !== undefined ) {
                    this.byteRangeRenderer.render( dataSent, dataMoved, parseInt(streamID, 0) );
                    this.byteRangeRenderer.zoom( this.currentDomain );
                }
            };
        }
    }

}
