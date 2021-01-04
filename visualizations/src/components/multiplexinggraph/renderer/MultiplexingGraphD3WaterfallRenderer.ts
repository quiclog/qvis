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
        let directionText    = "received";

        if ( this.connection.vantagePoint && this.connection.vantagePoint.type === qlog.VantagePointType.server ){
            requestEventType = qlog.TransportEventType.packet_received;
            dataEventType    = qlog.TransportEventType.packet_sent;
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
        }

        let dataFrameCount:number = 0;

        const streams:Map<number, StreamExtents> = new Map<number, StreamExtents>();

        for ( const eventRaw of this.connection.getEvents() ) {
            const evt = this.connection.parseEvent( eventRaw );
            const data = evt.data;

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

                    stream = { stream_id: streamID, order: streams.size, requestIndex: dataFrameCount, startIndex: -1, stopIndex: -1, requestTime: evt.relativeTime, startTime: -1, endTime: -1, frameCount: 0, totalData: 0 };
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

        rects2
            .append("circle")
                .attr("cx", (d:any) => { return xDomain(d.requestIndex) + circleWidth / 2; } )
                .attr("cy", (d:any) => { return ((d.order) * minBarHeight) + (circleWidth / 1.6); } ) // 1.6 should be 2, but 1.6 somehow looks better...
                .attr("fill", (d:any) => { return StreamGraphDataHelper.StreamIDToColor("" + d.stream_id)[0]; } )
                .attr("stroke", "black" )
                .attr("stroke-width", (d:any) => { return circleWidth / 5; } )
                .attr("r", circleWidth / 2 );

        // const legendY = ((-2) * (this.barHeight / streams.size)) + (circleWidth / 1.6); // 1.6 should be 2, but 1.6 somehow looks better...

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
