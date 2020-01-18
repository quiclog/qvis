import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@quictools/qlog-schema';
import StreamGraphDataHelper from './MultiplexingGraphDataHelper';
import MultiplexingGraphD3ByterangesRenderer from './MultiplexingGraphD3ByterangesRenderer';


interface StreamRange {
    currentHead:number, // up to and including where the stream has been moved to the HTTP layer
    highestReceived:number, // up to where the stream has been received (with holes between currentHead and this if they're not equal)
    holes:Array<Range>,
    filled:Array<Range>,

    cumulativeTimeDifference:number,
    timeDifferenceSampleCount:number,

    frameCount:number,
}

interface StreamStats {
    frameSizes:Array<number>,
    gapFillingTimestampDifferences:Array<number>,
    dataMovedTimestampDifferences:Array<number>,
    dataMovedSizes:Array<number>,

    lastDataMovedTimestamp:number
}

interface ConnectionStats {
    streamFramesPerPacket:Array<number>, // amount of frames in a single packet (both same and not-same streams), only when packets included stream frames!
    packetsWithSameStreamFramesCount:number, // count of packets that had frames of the same stream in them 
    dataMovedTimestampDifferences:Array<number>, // we have these both at per-stream and connection level for better reasoning about holblocking
    dataMovedSizes:Array<number>, // sizes of the data_moved events
    dataMovedHOLblockedPacketsCount:Array<number>, // amount of packets between each dataMoved event 

    lastDataMovedTimestamp:number,
    packetsCountSinceLastDataMoved:number,
    dataCarryingPacketCount:number,

    TCP_holBlockedBytes:Array<number>, // amount of data_moved bytes between each time we become un-holblocked in TCP simulation
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

    // public svgID:string;
    public rendering:boolean = false;

    protected svg!:any;
    protected tooltip!:any;
    protected connection!:QlogConnection;

    protected barHeight = 70;

    protected DEBUG_optimizeForScreenshots = false; // primarily for multiplexing screenshots, messes with data, so not usable for byteranges below
    protected DEBUG_printready = true; // primarily for byteranges

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

        this.dimensions.margin = {top: 0, right: Math.round(container.clientWidth * 0.05), bottom: 20, left: 20};
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
        const streamStats:Map<number, StreamStats>  = new Map<number, StreamStats>();
        const connectionStats: ConnectionStats  = { 
            streamFramesPerPacket: new Array<number>(), 
            packetsWithSameStreamFramesCount: 0, 
            dataMovedTimestampDifferences: new Array<number>(),  
            dataMovedSizes: new Array<number>(),
            dataMovedHOLblockedPacketsCount: new Array<number>(), 
            lastDataMovedTimestamp: -1, 
            packetsCountSinceLastDataMoved: 0,
            dataCarryingPacketCount: 0,

            TCP_holBlockedBytes: new Array<number>(),
        };

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

        const TCP_HOLBlockedStreams:Array<number> = new Array<number>();
        let TCP_HOLBlockedBytes:number = 0;

        const dataSent:Array<any> = [];
        for ( const eventRaw of this.connection.getEvents() ) {

            const event = this.connection.parseEvent( eventRaw );
            const data = event.data;

            if ( event.name === eventType ){ // packet_sent or _received, the ones we want to plot

                const streamFrames = new Array<any>();

                if ( data.frames && data.frames.length > 0 ){
                    for ( const frame of data.frames ) {

                        if ( !frame.stream_id || !StreamGraphDataHelper.isDataStream( frame.stream_id )){
                            // skip control streams like QPACK
                            continue;
                        }

                        if ( frame.frame_type && frame.frame_type === qlog.QUICFrameTypeName.stream ){

                            streamFrames.push ( frame );

                            let ranges = streamRanges.get( frame.stream_id );
                            if ( !ranges ){
                                ranges = 
                                {currentHead:-1, highestReceived: -1, holes: new Array<Range>(), filled:new Array<Range>(), cumulativeTimeDifference: 0, timeDifferenceSampleCount: 0, frameCount: 0 };
                                streamRanges.set( frame.stream_id, ranges );
                            }

                            let stats = streamStats.get(frame.stream_id);
                            if ( !stats ) {
                                stats = {
                                    frameSizes: new Array<number>(),
                                    gapFillingTimestampDifferences: new Array<number>(),
                                    dataMovedTimestampDifferences: new Array<number>(),
                                    dataMovedSizes: new Array<number>(),
                                    lastDataMovedTimestamp: -1,
                                };
                                streamStats.set( frame.stream_id, stats);
                            }

                            let holeCountBefore:number = ranges.holes.length;

                            const arrivalInfo:ArrivalInfo = 
                                calculateFrameArrivalType(ranges, event.relativeTime, parseInt(frame.offset, 10), parseInt(frame.offset, 10) + parseInt(frame.length, 10) - 1 );

                            ranges.frameCount += 1;

                            let skip = false;
                            if ( this.DEBUG_optimizeForScreenshots ) { // TODO: FIXME: REMOVE THIS IF TEST, JUST TO MAKE VIZ LESS BUSY FOR SCREENSHOTS!!!
                                skip = ranges.frameCount % 2 !== 0;
                            }

                            
                            if ( !skip ) {
                                dataSent.push( {
                                    streamID: frame.stream_id, 
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
                            }

                            stats.frameSizes.push ( parseInt(frame.length, 10) );
                            stats.gapFillingTimestampDifferences.push( arrivalInfo.timeDifference );

                            streamIDs.add( frame.stream_id );



                            // TCP holblock simulation
                            // -----------------------
                            const holeCountAfter = ranges.holes.length;

                            if ( holeCountAfter > holeCountBefore ) { // new hole created
                                TCP_HOLBlockedStreams.push( frame.stream_id );
                                // console.log("HOLE found", frame.stream_id, TCP_HOLBlockedStreams);
                            }
                            // holes that were removed are taken into account below with data_moved


                            // // TODO: keep Map of stream to blocked count -> add to the correct stream for which this frame is carrying data
                            // // then: either we swallow inaccuracies for ones that multiplex from different streams (should get an idea how how many those are then)
                            // const itemsToRemove:Array<number> = new Array<number>();
                            // for ( const streamID of TCP_HOLBlockedStreams.values() ) {
                            //     // this is in INSERTION order, so the first one is the one that could be holblocking us
                                
                            //     const blockedStreamInfo = streamRanges.get( streamID );
                            //     if ( blockedStreamInfo!.holes && blockedStreamInfo!.holes.length === 0 ) {
                            //         itemsToRemove.push( streamID );
                            //     }
                            // }

                            // const streamInfo = streamRanges.get( frame.stream_id );
                            // // if not yet in the holblocking list and now holblocking, add it 
                            // if ( streamInfo!.holes.length > 0 && !TCP_HOLBlockedStreams.has(frame.stream_id) ) {
                            //     TCP_HOLBlockedStreams.add( frame.stream_id );
                            // }

                            // const sizeBefore = TCP_HOLBlockedStreams.size;
                            // for ( const toRemove of itemsToRemove ) {
                            //     TCP_HOLBlockedStreams.delete( toRemove );
                            // }

                            // if ( itemsToRemove.length > 0 ) {
                            //     connectionStats.TCP_holBlockedPacketsCount.push ( connectionStats.TCP_dataCarryingPacketCount );
                            //     connectionStats.TCP_dataCarryingPacketCount = -1; // because it will be increased after this 

                            //     // console.error("BECAME UN-HOLBLOCKED AFTER x PACKETS", connectionStats.TCP_holBlockedPacketsCount[connectionStats.TCP_holBlockedPacketsCount.length - 1]);
                            // }

                            // if ( TCP_HOLBlockedStreams.size > 0 ) {
                            //     console.log("TCP hol blocking set is now : ", TCP_HOLBlockedStreams, itemsToRemove);
                            // }
                            // if ( sizeBefore > 0 && TCP_HOLBlockedStreams.size === 0 ) {
                            //     console.log("Holblock ended", TCP_HOLBlockedStreams, itemsToRemove);
                            // }
                            // -----------------------
                        }
                    }


                    if ( streamFrames.length > 0 ){
                        connectionStats.streamFramesPerPacket.push( streamFrames.length );

                        const streamIDpresent = new Set<string>();

                        for ( const frame of streamFrames ) {
                            const streamID = "" + frame.stream_id;
                            if ( streamIDpresent.has(streamID) ){
                                connectionStats.packetsWithSameStreamFramesCount += 1;
                            }
                            else {
                                streamIDpresent.add( streamID );
                            }
                        }
                    }
                }

                if ( streamFrames.length > 0 ) {
                    connectionStats.packetsCountSinceLastDataMoved += 1;
                    connectionStats.dataCarryingPacketCount += 1;
                }
            }
            else if ( event.name === qlog.HTTP3EventType.data_moved ) {
                // console.log("Data was moved!", data);

                if ( !StreamGraphDataHelper.isDataStream( data.stream_id )){
                    continue;
                }

                if ( dataSent.length === 0 ) {
                    console.error("data moved but no stream frames seen yet... shouldn't happen!", data);
                    continue;
                }

                // would like to simply say that the last element in dataSent led to this, but sadly that's not true if there were coalesced frames in 1 packet... darnit
                // so... need to search backwards to see if we can find something
                let firstCandidate = undefined;
                let foundFrame = undefined;
                for ( let i = dataSent.length - 1; i >= 0; --i ) {
                    if ( dataSent[i].streamID === "" + data.stream_id ) {

                        // deal with frames containing two frames of the same stream... then it's not just the last one of that strea, DERP
                        // there are stacks that for example encode the headers in a separate frame and the body too (e.g., picoquic)
                        if ( firstCandidate === undefined ){
                            firstCandidate = dataSent[i];
                        }

                        if ( dataSent[i].offset === parseInt(data.offset, 10) ) {
                            foundFrame = dataSent[i];
                            break;
                        }
                    }
                }

                if ( firstCandidate === undefined ) {
                    console.error("Data moved but no triggering stream frame found, impossible!!!", dataSent, event.relativeTime, data);
                    continue;
                }

                if ( !foundFrame ) {
                    console.error("Data moved but didn't start at previous stream's offset, impossible!!!", foundFrame, event.relativeTime, data);
                    continue;
                }

                foundFrame.dataMoved = data.length;

                const streamStat = streamStats.get( data.stream_id ); // MUST be set in previous logic, otherwise have moved data before receiving stream frame, we check for that above
                if ( streamStat!.lastDataMovedTimestamp !== -1 ){
                    const timeDiff = event.relativeTime - streamStat!.lastDataMovedTimestamp;
                    streamStat!.dataMovedTimestampDifferences.push( timeDiff );
                }
                
                streamStat!.dataMovedSizes.push( data.length );
                streamStat!.lastDataMovedTimestamp = event.relativeTime;

                if ( connectionStats.lastDataMovedTimestamp !== -1 ){
                    const timeDiffConn = event.relativeTime - connectionStats.lastDataMovedTimestamp;
                    connectionStats.dataMovedTimestampDifferences.push(timeDiffConn);
                }

                connectionStats.lastDataMovedTimestamp = event.relativeTime;
                connectionStats.dataMovedSizes.push( data.length );

                if ( connectionStats.packetsCountSinceLastDataMoved < 1 ) {
                    // we want to only count packets, but data_moved is logged per stream frame, and 1 packet can contain multiple stream frames
                    // so, if we've already counted the packet triggering this current data_moved (packetsCountSinceLastDataMoved is 0), we don't need to do anything
                }
                else {
                    // do -1 here, because we always need at least 1 packet to trigger a dataMoved. the current one isn't counted, since that one stops the holBlocking
                    connectionStats.dataMovedHOLblockedPacketsCount.push ( connectionStats.packetsCountSinceLastDataMoved - 1 );
                    connectionStats.packetsCountSinceLastDataMoved = 0;
                }

                // TCP_HolBlocking simulation
                if ( TCP_HOLBlockedStreams.length > 0 ) {        
                    const streamID = data.stream_id;
                    if ( TCP_HOLBlockedStreams[0] === streamID ) {
                        // we have stopped holblocking! whooptiedoo! 
                        TCP_HOLBlockedBytes += data.length;
                        connectionStats.TCP_holBlockedBytes.push( TCP_HOLBlockedBytes );
                        TCP_HOLBlockedBytes = 0;

                        // TCP_HOLBlockedStreams.shift(); // remove the holblocker from the front // is done automatically below in the normal loop


                        // could be that other holes have been filled while waiting for our currenlty resolved one
                        // so need to loop over all streams and remove them from the front of our queue 
                        for ( let checkStreamID of streamRanges.keys() ) {

                            const holeCount = streamRanges.get( checkStreamID )!.holes.length;
                            let holBlockCount = 0;
                            for ( const stream of TCP_HOLBlockedStreams ){
                                if ( stream === checkStreamID ){
                                    holBlockCount += 1;
                                } 
                            }


                            const toRemoveCount = holBlockCount - holeCount;
                            if ( toRemoveCount < 0 ) {
                                console.error("Less holblocked holes than there actually are in the stream... very strange", TCP_HOLBlockedStreams, holeCount);
                            }
                            else {
                                for ( let i = 0; i < toRemoveCount; ++i ){
                                    const nextIndex = TCP_HOLBlockedStreams.indexOf( checkStreamID );
                                    TCP_HOLBlockedStreams.splice(nextIndex, 1);
                                    // console.log("Removed hole for ", checkStreamID );
                                }

                                // if ( toRemoveCount > 1 ){
                                //     console.error("INFO : removed more than one hole!", checkStreamID, toRemoveCount);
                                // }
                            }
                        }

                        //console.log("Stopped holblocking at one hole, list is now", streamID, TCP_HOLBlockedStreams, parseInt(data.offset), " -> ", parseInt(data.offset) + parseInt(data.length) - 1, JSON.stringify(streamRanges.get( streamID )!.holes));
                    }
                    else {
                        //console.log("Got data from stream, not the first holblocker though", streamID, "!=", TCP_HOLBlockedStreams[0] );
                        TCP_HOLBlockedBytes += data.length;
                    }
                }
                else {
                    connectionStats.TCP_holBlockedBytes.push( data.length );
                }

            }
        }

        for ( const [stream_id, range] of streamRanges ) {
            if ( range.holes && range.holes.length !== 0 ) {
                alert("Stream still had holes after done! Shouldn't happen! " + stream_id + " has " + range.holes.length );
                console.error("MultiplexingGraphD3CollapsedRenderer : stream has holes, didn't finish completely!", stream_id, range.holes);
            }
        }

        if ( TCP_HOLBlockedStreams.length > 0 ){
            alert("Still streams with hol blocking in TCP simulation, shouldn't happen!" );
            console.error("Still streams with hol blocking in TCP simulation, shouldn't happen!", TCP_HOLBlockedStreams );
        }

        console.log("Connection stats", connectionStats);
        console.log("Stream stats", streamStats);

        if ( !this.DEBUG_optimizeForScreenshots && window.location.toString().indexOf(":8080") >= 0 ){ // only for local testing for now! // TODO: CLEAN UP
            this.renderStats( dataSent, this.connection, connectionStats, streamStats );
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

        if ( this.DEBUG_optimizeForScreenshots ) {
            this.barHeight = this.barHeight * 0.9;
        }


        const packetSidePadding = 0.3;

        const xDomain = d3.scaleLinear()
            .domain([1, frameCount])
            .range([ 0, this.dimensions.width ]);

        const xAxis = this.svg.append("g");
        
        if ( !this.DEBUG_printready ){
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
                .attr("fill", (d:any) => StreamGraphDataHelper.streamIDToColor(d.streamID)[0] /*"" + colorDomain( "" + d.streamID )*/ )
                .style("opacity", 1)
                .attr("class", "packet")
                .attr("width", (d:any) => xDomain(d.countEnd) - xDomain(d.countStart) + packetSidePadding * 2)
                .attr("height", (d:any) => packetHeight * (d.index % 2 === 0 ? 1 : 0.90))
                .style("pointer-events", "all")
                .on("mouseover", packetMouseOver)
                .on("mouseout", packetMouseOut)
                .on("click", (d:any) => { this.byteRangeRenderer.render(dataSent, d.streamID); });

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

        if ( !this.DEBUG_optimizeForScreenshots && !this.DEBUG_printready ) {
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
        }

        if ( !this.DEBUG_printready ) {
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
        }

        const updateChart = () => {

            // recover the new scale
            const newX = d3.event.transform.rescaleX(xDomain);

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
            this.byteRangeRenderer.render( dataSent, 0 );
        }
    }

    protected renderStats( allFrames:Array<any>, connection:QlogConnection, connectionStats:ConnectionStats, streamStats:Map<number, StreamStats> ){
        
        let win = (window as any);
        if ( !win.holblockinfo ) {
            win.holblockinfo = new Array<any>();
        }
        win.conninfo = connection.parent.filename;

        let statsContainer = d3.select("#multiplexing-stats")
            .style("opacity", 1)
            .style("padding", "5px")
            .style("background", "lightsteelblue");


            if ( connectionStats.TCP_holBlockedBytes.length > 0 ) {
                win.holblockinfo.push( {maxTCP: Math.max(...connectionStats.TCP_holBlockedBytes), maxQUIC:Math.max(...connectionStats.dataMovedSizes) } );
            }

        let text = "";

        text += "HOL BLOCK AGGREGATED INFO " + win.conninfo + " = " + JSON.stringify( win.holblockinfo ) + ";"; 

        text += "<h2>Connection stats</h2>";
        text += "<p>";

        text += "# packets with same stream frames: " + connectionStats.packetsWithSameStreamFramesCount + "</br>";
        
        text += "<u># stream frames</u> : <u># packets with that many stream frames</u><br/>";
        text += this.generateBoxplot( connectionStats.streamFramesPerPacket );
        text += "<u>Data moved timestamp distribution</u><br/>";
        text += this.generateAggregates( connectionStats.dataMovedTimestampDifferences );
        text += "<u>Data moved size distribution</u><br/>";
        text += this.generateAggregates( connectionStats.dataMovedSizes );
        text += "<u>Holblocked packet count distribution</u><br/>";
        text += this.generateAggregates( connectionStats.dataMovedHOLblockedPacketsCount );
        text += "<u>Holblocked TCP dataMoved bytes distribution</u><br/>";
        text += this.generateAggregates( connectionStats.TCP_holBlockedBytes );


        // calculate % of time we were holblocked in this connection
        // TODO: we should also be able to simulate TCP based on this: only do data_moved if all gaps are filled (though, hmz, that requires tracking this across streams... hmz)

        let retransmittedFrameCount = allFrames.reduce( (a,b) => { if ( b.arrivalType === FrameArrivalType.Retransmit || b.arrivalType === FrameArrivalType.Reordered){ return a + 1; } else { return a; } }, 0);

        if ( allFrames.length > 0 ){
            const totalPacketCount = connectionStats.dataCarryingPacketCount;
            const blockedPacketCount = connectionStats.dataMovedHOLblockedPacketsCount.reduce( (a, b) => a + b, 0);

            text += "<br/>";
            text += "This connection was hol blocked " + blockedPacketCount + " packets out of " + totalPacketCount + " packets. Is " + (( Math.round((blockedPacketCount / totalPacketCount) * 100) / 100) * 100) + "%";
            text += " // " + retransmittedFrameCount + " retransmitted frames on total of " + allFrames.length + " frames " + (( Math.round((retransmittedFrameCount / allFrames.length) * 100) / 100) * 100) + "%";
        }

        text += "</p>";

        statsContainer
            .html( text ); 
        
        
        // statsContainer = d3.select("#multiplexing-stats-streams")
        //     .style("opacity", 1)
        //     .style("padding", "5px")
        //     .style("background", "lightgreen");

        // text = "";

        // text += "<h2>Stream stats</h2>";
        // text += "<p>";

        // for ( const [streamID, stats] of streamStats ) {
        //     // text += "<u>Stream " + streamID + " datamoved timestamp distribution</u><br/>";
        //     // text += this.generateAggregates( stats.dataMovedTimestampDifferences );
        //     // text += "<u>Stream " + streamID + " datamoved size distribution</u><br/>";
        //     // text += this.generateAggregates( stats.dataMovedSizes );
        //     text += "<u>Stream " + streamID + " time it takes to fill gaps</u><br/>";
        //     text += this.generateAggregates( stats.gapFillingTimestampDifferences );
        // }


        // text += "</p>";

        // statsContainer
        //     .html( text );
    }

    protected generateBoxplot( nums:Array<number> ){
        let boxes:Map<number, number> = new Map<number, number>();

        for ( const num of nums ) {
            let count = 0;

            if ( boxes.has(num) ) {
                count = boxes.get(num)!;
            }

            count += 1;
            boxes.set( num, count );
        }

        let output = "";
        for ( const [num,count] of boxes ) {
            output += "" + num + " : " + count + "<br/>";
        }

        return output;
    }

    protected generateAggregates( nums:Array<number> ) {

        // https://stackoverflow.com/questions/48719873/how-to-get-median-and-quartiles-percentiles-of-an-array-in-javascript-or-php

        const quartile = (input:Array<number>, q:number ) => {
            const data = input.sort( (a,b) => a - b );

            const pos = ((data.length) - 1) * q;
            const base = Math.floor(pos);
            const rest = pos - base;

            if ( (data[base + 1] !== undefined) ) {
                return data[base] + rest * (data[base + 1] - data[base]);
            } 
            else {
                return data[base];
            }
        };

        const sum = (input:Array<number>) => {
            return input.reduce( (a, b) => a + b, 0); 
        }

        let output = "";

        output += "[" + Math.min(...nums) + ", " + Math.max(...nums) + "]</br>";
        output += "p25 : "      + quartile(nums, 0.25) + "<br/>";
        output += "median : "   + quartile(nums, 0.5)  + "<br/>";
        output += "p75 : "      + quartile(nums, 0.75) + "<br/>";
        output += "p99 : "      + Math.round( quartile(nums, 0.99) ) + "<br/>";
        output += "p9999 : "    + Math.round( quartile(nums, 0.9999) ) + "<br/>";
        output += "mean : "     + (sum(nums) / nums.length) + "<br/>";

        output += "" + this.connection.parent.filename + "<br/>";
        output += "min p25 median p75 p99 p9999 max mean" + "<br/>";
        output += "" + Math.min(...nums) + " " + quartile(nums, 0.25) + " " + quartile(nums, 0.5) + " " + quartile(nums, 0.75) + " " + quartile(nums, 0.99) + " " + Math.round( quartile(nums, 0.9999) ) + " " + Math.max(...nums) + " " + (sum(nums) / nums.length) + "<br/>";

            // function Array_Stdev(tab){
            // var i,j,total = 0, mean = 0, diffSqredArr = [];
            // for(i=0;i<tab.length;i+=1){
            //     total+=tab[i];
            // }
            // mean = total/tab.length;
            // for(j=0;j<tab.length;j+=1){
            //     diffSqredArr.push(Math.pow((tab[j]-mean),2));
            // }
            // return (Math.sqrt(diffSqredArr.reduce(function(firstEl, nextEl){
            //         return firstEl + nextEl;
            //     })/tab.length));  
            // }

        
        return output;
    }

}
