import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@/data/QlogSchema';
import StreamGraphDataHelper from './MultiplexingGraphDataHelper';


export default class MultiplexingGraphD3WaterfallRenderer {

    public containerID:string;

    public rendering:boolean = false;

    // FIXME: do this properly with a passed-in config object or something!
    public onStreamClicked: ((streamID:string) => void) | undefined = undefined // set by the CollapsedRenderer directly (yes, I know, dirty)

    // TODO: merge this with the one above in a proper event emitter setup
    // the above is to handle clicks from within the CollapsedRenderer (to update the ByteRangesRenderer)
    // this one is to handle clicks from the upper-layer Vue renderer to show stream details
    protected onStreamClickedUpper:(streamDetails:any) => void;

    protected svg!:any;
    protected connection!:QlogConnection;

    protected barHeight = 120;

    private dimensions:any = {};

    constructor(containerID:string, onStreamClickedUpper:(streamDetails:any) => void) {
        this.containerID = containerID;
        this.onStreamClickedUpper = onStreamClickedUpper;
    }
   
    public async render(connection:QlogConnection):Promise<boolean> {
        if ( this.rendering ) {
            return false;
        }

        console.log("MultiplexingGraphD3WaterfallRenderer:render", connection);

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

        this.dimensions.margin = {top: 40, right: 40, bottom: 0, left: 20};

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

        return true;
    }

    protected async renderLive() {
        console.log("Rendering multiplexing waterfall");

        // const parser = this.connection.getEventParser();

        // // want total millisecond range in this trace, so last - first
        // const xMSRange = parser.load(this.connection.getEvents()[ this.connection.getEvents().length - 1 ]).absoluteTime - 
        //                parser.load(this.connection.getEvents()[0]).absoluteTime;

        // console.log("DEBUG MS range for this trace: ", xMSRange);

        // want to render both when the request was sent/received, as well as the period of actually sending/receiving data
        // so that's two different perspectives

        // because we're plotting in "packet number space" instead of "time space" things do get a bit awkward...
        // cannot simply only loop over the packet_sent/received events, but loop over all the events and keep track of packet indices
        // this is to keep our x-axis in sync with that of the CollapsedRenderer

        let requestEventType = qlog.TransportEventType.packet_sent; // client sends requests, receives data
        let dataEventType    = qlog.TransportEventType.packet_received;
        let h3EventType      = qlog.HTTP3EventType.frame_created; // client sends requests with HEADERS and PRIORITY_UPDATE frames
        let directionText    = "received";

        if ( this.connection.vantagePoint && this.connection.vantagePoint.type === qlog.VantagePointType.server ){
            requestEventType = qlog.TransportEventType.packet_received;
            dataEventType    = qlog.TransportEventType.packet_sent;
            h3EventType      = qlog.HTTP3EventType.frame_parsed; // server receives requests with HEADERS and PRIORITY_UPDATE frames
            directionText    = "sent";
        }

        // const frames = this.connection.lookup( qlog.EventCategory.transport, eventType );

        interface StreamExtents {
            stream_id:number,
            order:number,
            requestIndex:number,
            startIndex:number,
            stopIndex:number,

            startTime:number,
            endTime:number,
            requestTime:number,
            frameCount:number,
            totalData:number,

            h3Info: H3StreamInfo | null,
        }

        interface H3StreamInfo {
            headersIndex:number,
            priorityUpdateIndex:number,

            headersTime:number,
            priorityUpdateTime:number,

            priorityString:string,
        }

        let dataFrameCount:number = 0;

        // key here is the StreamID 
        const streams:Map<number, StreamExtents> = new Map<number, StreamExtents>();
        const h3Infos:Map<number, H3StreamInfo> = new Map<number, H3StreamInfo>(); 

        // we want to look for both QUIC level STREAM events and also HTTP/3 level frame events
        // this gets complicated, because we also want stuff to work if there are NO HTTP/3 level things present.
        // Additionally, we can't be sure in which order stuff gets logged 
        // (e.g., first HTTP/3 frame_created with headers before the actual packet_sent with STREAM or vice versa)
        // As such, we track the HTTP/3 stuff separately and have two locations to try and reconsolidate based on the StreamID

        for ( const eventRaw of this.connection.getEvents() ) {
            const evt = this.connection.parseEvent( eventRaw );
            const data = evt.data;

            // just for the HTTP/3 events, looking for HEADERS or PRIORITY_UPDATE
            if ( evt.name === h3EventType ) {
                if ( !data.frame )
                    continue;

                let h3Info = null;
                let stream_id = -1;
                
                if ( data.frame.frame_type === qlog.HTTP3FrameTypeName.headers ) {

                    console.log("MultiplexingGraphD3WaterfallRenderer: HEADERS FOUND: ", evt.name, evt.data, evt.data.frame );
                    // we might have gotten h3Info from a PRIORITY_UPDATE frame before HEADERS
                    stream_id = parseInt("" + data.stream_id);
                    h3Info = h3Infos.get( stream_id );
                    if ( !h3Info ) {
                        h3Info = {
                            headersIndex: -1,
                            priorityUpdateIndex: -1,
                            headersTime: -1,
                            priorityUpdateTime: -1,
                            priorityString: ""
                        }
                    }

                    h3Info.headersIndex = dataFrameCount;
                    h3Info.headersTime = evt.relativeTime;

                    for ( let header of data.frame.headers ) {
                        if ( header.name === "priority" ) {
                            if ( h3Info.priorityString.length === 0 ) {
                                h3Info.priorityString = "HEADER: " + header.value;
                            }
                            else {
                                h3Info.priorityString += " -> HEADER: " + header.value; // headers updates value from PRIORITY_UPDATE frame
                            }
                        }
                    }
                }
                else if ( data.frame.frame_type === qlog.HTTP3FrameTypeName.priority_update )
                {
                    console.log("MultiplexingGraphD3WaterfallRenderer: PRIORITY_UPDATE FOUND: ", evt.name, evt.data, evt.data.frame );

                    // {"data": {"frame": {"frame_type": "priority_update", "element_id": 8, "value": "u=1,i"}, "length": 11, "stream_id": 2}
                    // here, the data.stream_id is always the stream ID of the control stream, as that's where the PRIORITY_UPDATE frames are sent
                    // the "real" stream_id we need here is the frame.element_id instead
                    // TODO: element_id can also be the push_id, but we don't handle that yet
                    stream_id = parseInt("" + data.frame.element_id);
                    h3Info = h3Infos.get( stream_id );
                    if ( !h3Info ) {
                        h3Info = {
                            headersIndex: -1,
                            priorityUpdateIndex: -1,
                            headersTime: -1,
                            priorityUpdateTime: -1,
                            priorityString: ""
                        }
                    }

                    h3Info.priorityUpdateIndex = dataFrameCount;
                    h3Info.priorityUpdateTime = evt.relativeTime;

                    if ( h3Info.priorityString.length === 0 ) {
                        h3Info.priorityString = "FRAME: " + data.frame.value;
                    }
                    else {
                        h3Info.priorityString += " -> FRAME: " + data.frame.value; // frame updates value from HEADERS
                    }
                }

                // see if we need to hook up the h3Info to an existing StreamExtents (e.g., packet_received was logged before frame_parsed, which is typical)
                if ( stream_id >= 0 && h3Info !== null ) {
                    let stream = streams.get( stream_id );
                    if ( stream ) {
                        stream.h3Info = h3Info;
                    }
                    // else: this gets dealt with below 

                    // always add to the global struct for easy tracking and debuggability (and memory leaks)
                    h3Infos.set( stream_id, h3Info );
                }
            }

            if ( evt.name !== requestEventType && evt.name !== dataEventType ) {
                continue;
            }

            if ( !data.frames ){
                continue;
            }

            const streamFrames = [];
            for ( const frame of data.frames ){
                if ( frame.frame_type === qlog.QUICFrameTypeName.stream ){
                    streamFrames.push( frame );
                }
            }

            if ( streamFrames.length === 0 ) {
                continue;
            }

            for ( const streamFrame of streamFrames ){
                if ( !StreamGraphDataHelper.isDataStream( "" + streamFrame.stream_id )) {
                    // skip control streams like QPACK
                    continue;
                }

                const streamID = parseInt( streamFrame.stream_id, 10 );

                if ( evt.name === dataEventType ) {
                    ++dataFrameCount;
                }

                let stream = streams.get( streamID );
                if ( !stream ){
                    
                    if ( evt.name !== requestEventType ){
                        console.error("MultiplexingGraphD3WaterfallRenderer: first packet for stream was not request! Shouldn't happen!", evt);
                        break;
                    }

                    stream = { 
                        stream_id: streamID, 
                        order: streams.size, 
                        requestIndex: dataFrameCount, 
                        startIndex: -1, 
                        stopIndex: -1, 
                        requestTime: evt.relativeTime, 
                        startTime: -1, 
                        endTime: -1, 
                        frameCount: 0, 
                        totalData: 0,
                        h3Info: null
                    };

                    let h3Info = h3Infos.get( streamID );
                    if ( h3Info ) {
                        // parsed before this, just need to link
                        stream!.h3Info = h3Info;
                    }
                    else {
                        // no H3info known yet: prepare in case it's discovered later 
                        stream.h3Info = {
                            headersIndex: -1,
                            priorityUpdateIndex: -1,
                            headersTime: -1,
                            priorityUpdateTime: -1,
                            priorityString: ""
                        }
                    }

                    streams.set( streamID, stream );
                }
                else {
                    if ( evt.name !== dataEventType ){
                        continue;
                    }

                    if ( stream.startIndex === -1 ){
                        stream.startIndex = dataFrameCount;
                        stream.startTime = evt.relativeTime;
                    }
                    
                    if ( dataFrameCount > stream.stopIndex ){
                        stream.stopIndex = dataFrameCount;
                        stream.endTime = evt.relativeTime;
                    }

                    stream.frameCount++;
                    stream.totalData += parseInt(streamFrame.length, 0);
                }
            }
        }

        console.log("MultiplexingGraphD3WaterfallRenderer: streams to be rendered: ", streams, h3Infos);

        let minBarHeight = 4; // 4px is minimum height. Above that, we start scrolling (at 120 normal height, 4px gives us 30 streams without scrollbar)
        if ( minBarHeight * streams.size < this.barHeight ) {
            minBarHeight = (this.barHeight * 0.95) / streams.size;
        }


        this.dimensions.height = Math.ceil(minBarHeight * streams.size) + this.dimensions.margin.top;

        // update the height of the surrounding container
        d3.select("#" + this.containerID + " svg").attr("height", this.dimensions.height);

        // TODO: what if no H3-level stuff found?!

        const xDomain = d3.scaleLinear()
            .domain([1, dataFrameCount])
            .range([ 0, this.dimensions.width ]);

        const xAxis = this.svg.append("g");
        
        // if( this.axisLocation === "top" ) {
        //     xAxis
        //         //.attr("transform", "translate(0," + this.dimensions.height + ")")
        //         .call(d3.axisTop(xDomain));
        // }
        // else {
        //     xAxis
        //         .attr("transform", "translate(0," + this.dimensions.height + ")")
        //         .call(d3.axisBottom(xDomain));
        // }


        // console.log("DEBUG: streamsFound", streams);

        // let colorDomain = d3.scaleOrdinal() 
        //     .domain(["0",   "4",     "8",    "12",   "16",     "20",     "24",     "28",    "32",   "36",    "40",  "44"])
        //     .range([ "red", "green", "blue", "pink", "purple", "yellow", "indigo", "black", "grey", "brown", "cyan", "orange"]);

        const clip = this.svg.append("defs").append("SVG:clipPath")
            .attr("id", "clip")
            .append("SVG:rect")
            .attr("width", this.dimensions.width + this.dimensions.margin.left )
            .attr("height", this.dimensions.height )
            .attr("x", -this.dimensions.margin.left ) // need a bit more space for the circles at the beginning if they're at dataFrameCount 0 
            .attr("y", 0);

        const rects = this.svg.append('g')
            // .attr("clip-path", "url(#clip)");

        if ( streams.size <= 1 || dataFrameCount < 5 ){
            // error message is already shown in the CollapsedRenderer
            rects
            // text
            .append("text")
                .attr("x", 200 )
                .attr("y", 100 ) // + 1 is eyeballed magic number
                .attr("dominant-baseline", "baseline")
                .style("text-anchor", "start")
                .style("font-size", "14")
                .style("font-family", "Trebuchet MS")
                // .style("font-weight", "bold")
                .attr("fill", "#000000")
                .text( "This trace doesn't contain multiple independent streams (or has less than 5 STREAM frames), which is needed for the waterfall." );

            return;
        }

        const rects2 = rects
            .selectAll("rect")
            .data([...streams.values()])
            .enter()
            .append("g");

        const minWidth = 4; // 4px minimum width

        rects2
            // background
            .append("rect")
                .attr("x", (d:any) => { return xDomain(d.startIndex) - 0.15; } )
                .attr("y", (d:any) => { return d.order * minBarHeight; } )
                // .attr("fill", (d:any) => { return "" + colorDomain( "" + d.streamID ); } )
                .attr("fill", (d:any) => { return StreamGraphDataHelper.StreamIDToColor("" + d.stream_id)[0]; } )
                .style("opacity", 1)
                .attr("class", "packet")
                .attr("width", (d:any) => { return Math.max(minWidth, xDomain(d.stopIndex) - xDomain(d.startIndex)  + 0.3); })
                .attr("height", Math.max(minBarHeight, 0.01))
                .on("click", (d:any) => { 
                    if ( this.onStreamClickedUpper ) {
                        const details:any = {};
                        details.stream_id = d.stream_id;
                        details.data = streams.get( d.stream_id );
                        this.onStreamClickedUpper( details ); // updates stream detail in vue-layer
                    }
                    if ( this.onStreamClicked ) { 
                        this.onStreamClicked("" + d.stream_id); // updates byteRangeRenderer
                    } 
                });

        const circleWidth = Math.min(15 ,Math.max(minBarHeight / 1.2, 0.01));
        const rectWidth = circleWidth;

        // request indicator: circle
        rects2
            .append("circle")
                .attr("cx", (d:any) => { return xDomain(d.requestIndex) + circleWidth / 2; } )
                .attr("cy", (d:any) => { return ((d.order) * minBarHeight) + (circleWidth / 1.6); } ) // 1.6 should be 2, but 1.6 somehow looks better...
                .attr("fill", (d:any) => { return StreamGraphDataHelper.StreamIDToColor("" + d.stream_id)[0]; } )
                .attr("stroke", "black" )
                .attr("stroke-width", (d:any) => { return circleWidth / 5; } )
                .attr("r", circleWidth / 2 );

            
        // HEADERS indicator: square
        rects2
            .filter( (d:any) => { return d && d.h3Info && d.h3Info.headersIndex >= 0 } )
            .append("rect")
                .attr("x", (d:any) => { return xDomain(d.h3Info.headersIndex); } )
                .attr("y", (d:any) => { return ((d.order) * minBarHeight) + (rectWidth / 10); } )
                .attr("fill", (d:any) => { return StreamGraphDataHelper.StreamIDToColor("" + d.stream_id)[0]; } )
                .attr("stroke", "black" )
                .attr("stroke-width", (d:any) => { return rectWidth / 5; } )
                .attr("width", rectWidth )
                .attr("height", rectWidth );

        // PRIORITY UPDATE frame indicator: triangle
        // we want equilateral triangles with the base on the bottom
        // using relative SVG coordinates to draw a path with the line command (l)
        // each coordinate is relative to the previous one!
        let trianglePath = "m 0," + rectWidth; // move to bottom left of the triangle
        trianglePath += " l " + rectWidth + ",0"; // move to bottom right. y is already correct, only move x
        trianglePath += " l -" + (rectWidth/2) + ",-" + rectWidth; // move to the middle on top, relative to bottom right 
        trianglePath += " z"; // close path

        rects2
            .filter( (d:any) => { return d && d.h3Info && d.h3Info.priorityUpdateIndex >= 0 } )
            .append("path")
                .attr("d", trianglePath)
                // normal x and y doesn't work on path for some reason... thanks SVG
                .attr("transform", function(d:any) { return "translate(" + xDomain(d.h3Info.priorityUpdateIndex) + "," + (((d.order) * minBarHeight) + (rectWidth / 10)) + ")"; })
                .attr("fill", (d:any) => { return StreamGraphDataHelper.StreamIDToColor("" + d.stream_id)[0]; } )
                .attr("stroke", "black" )
                .attr("stroke-width", (d:any) => { return rectWidth / 5; } )

        // const legendY = ((-2) * (this.barHeight / streams.size)) + (circleWidth / 1.6); // 1.6 should be 2, but 1.6 somehow looks better...


        // legend top left
        const legendY = -this.dimensions.margin.top / 2;
        const legendIconWidth = 13;

        rects
            .append("circle")
                .attr("cx", xDomain(0) + legendIconWidth / 2 )
                .attr("cy", legendY ) 
                .attr("fill", (d:any) => { return "white" } )
                .attr("stroke", (d:any) => { return "black"; } )
                .attr("stroke-width", (d:any) => { return legendIconWidth / 5; } )
                .attr("r", legendIconWidth / 2 );

        rects
            // text
            .append("text")
                .attr("x", xDomain(0) + legendIconWidth / 2 + 20 )
                .attr("y", legendY + 1 ) // + 1 is eyeballed magic number
                .attr("dominant-baseline", "middle")
                .style("text-anchor", "start")
                .style("font-size", "14")
                .style("font-family", "Trebuchet MS")
                // .style("font-weight", "bold")
                .attr("fill", "#000000")
                .text( "Request " + directionText );

        rects
            .append("rect")
                .attr("x", xDomain(0) + legendIconWidth / 2 + 150 )
                .attr("y", legendY - legendIconWidth / 2 ) 
                .attr("fill", (d:any) => { return "white" } )
                .attr("stroke", (d:any) => { return "black"; } )
                .attr("stroke-width", (d:any) => { return legendIconWidth / 5; } )
                .attr("width", 20 )
                .attr("height", legendIconWidth );

        rects
            // text
            .append("text")
                .attr("x", xDomain(0) + legendIconWidth / 2 + 180 )
                .attr("y", legendY ) // + 1 is eyeballed magic number
                .attr("dominant-baseline", "middle")
                .style("text-anchor", "start")
                .style("font-size", "14")
                .style("font-family", "Trebuchet MS")
                // .style("font-weight", "bold")
                .attr("fill", "#000000")
                .text( "Colored while stream is \"active\" (between first and last STREAM frame " + directionText + ")");
    }

}
