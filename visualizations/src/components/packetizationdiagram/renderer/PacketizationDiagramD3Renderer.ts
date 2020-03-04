import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as tcpqlog from "@/components/filemanager/pcapconverter/qlog_tcp_tls_h2"
import * as qlog from '@quictools/qlog-schema';

interface Range {
    start: number,
    size: number
}

export default class PacketizationDiagramD3Renderer {

    public containerID:string;
    public axisLocation:"top"|"bottom" = "bottom";

    // public svgID:string;
    public rendering:boolean = false;

    protected svg!:any;
    protected tooltip!:any;
    protected connection!:QlogConnection;

    protected totalHeight = 100;

    private dimensions:any = {};

    constructor(containerID:string) {
        this.containerID = containerID;
    }
   
    public async render(connection:QlogConnection, collapsed:boolean ):Promise<boolean> {
        if ( this.rendering ) {
            return false;
        }

        console.log("PacketizationDiagramD3Renderer:render", connection);

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

        this.dimensions.margin = {top: 20, right: Math.round(container.clientWidth * 0.05), bottom: 20, left: 20};
        if ( this.axisLocation === "top" ){
            this.dimensions.margin.top = 20;
        }
        else {
            this.dimensions.margin.bottom = 40;
        }

        // width and height are the INTERNAL widths (so without the margins)
        this.dimensions.width = container.clientWidth - this.dimensions.margin.left - this.dimensions.margin.right;
        this.dimensions.height = this.totalHeight;


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

        this.tooltip = d3.select("#packetization-packet-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("padding", "5px")
            .style("pointer-events", "none") // crucial! 
            .style("background", "lightsteelblue");

        return true;
    }

    protected extractRanges(ranges:Array<Range>, size:number) {
        const output:Array<Range> = new Array<Range>();

        let remainingLength = size;

        if ( size === 0 ) {
            console.warn("Trying to extract ranges for size 0... potential error? Skipping...");

            return output;
        }

        while ( ranges.length > 0 ) {
            const range = ranges.shift();

            // either we consume the range, or we need to split it
            // the last option should only happen once at maximum, at the very end of this run
            if ( range!.start + range!.size <= range!.start + remainingLength ) {
                // full range is consumed
                // console.log("Consuming range!", range!.start, range!.size, remainingLength );
                output.push( range! );
            }
            else {
                // console.log("Splitting range!", range!.start, range!.size, remainingLength );

                if ( size === 5 && remainingLength < 5 ) { // header is being split... bad for performance
                    console.warn("Splitting a header range... server is being bad/naive?", size);
                }

                // range needs to be split
                ranges.unshift( {start: range!.start + remainingLength, size: range!.size - remainingLength} );
                range!.size = remainingLength; // this struct isn't added back to the "ranges" array, so can safely change it for use below

                output.push( range! );
            }

            if ( range!.size < 0 ) { // sanity check
                console.error("PacketizationDiagram:extractRanges : Negative size after extracting ranges! Should not happen!", range!.size, range, ranges);
            }

            remainingLength -= range!.size;

            if ( remainingLength < 0 ) { // sanity check
                alert("Remaining length < 0, CANNOT HAPPEN!");
                break;
            }

            if ( remainingLength === 0 ) {
                break;
            }
        }

        if ( remainingLength !== 0 ) {
            alert("Trying to fill payloadranges that aren't there! " + remainingLength);
        }

        return output;
    }

    protected async renderLive() {
        console.log("Rendering packetization diagram");

        // const parser = this.connection.getEventParser();

        // want total millisecond range in this trace, so last - first
        // const xMSRange = parser.load(this.connection.getEvents()[ this.connection.getEvents().length - 1 ]).absoluteTime - 
        //                parser.load(this.connection.getEvents()[0]).absoluteTime;

        // console.log("DEBUG MS range for this trace: ", xMSRange);



        // clients receive data, servers send it
        let TCPEventType = qlog.TransportEventType.packet_received;
        let TLSEventType = tcpqlog.TLSEventType.record_parsed;
        let HTTPEventType = tcpqlog.HTTP2EventType.frame_parsed;
        let HTTPHeadersSentEventType = tcpqlog.HTTP2EventType.frame_created; // client sends request
        let directionText = "received";


        if ( this.connection.vantagePoint && this.connection.vantagePoint.type === qlog.VantagePointType.server ){
            TCPEventType = qlog.TransportEventType.packet_sent;
            TLSEventType = tcpqlog.TLSEventType.record_created;
            HTTPEventType = tcpqlog.HTTP2EventType.frame_created;
            HTTPHeadersSentEventType = tcpqlog.HTTP2EventType.frame_parsed; // server receives request
            directionText = "sent";
        }

        let lastTCPEvent:any = undefined;
        let lastTLSEvent:any = undefined;

        const TCPData:Array<any> = [];
        const TLSData:Array<any> = [];
        const HTTPData:Array<any> = [];

        let TCPindex = 0;
        let TLSindex = 0;
        let HTTPindex = 0;

        let TCPmax = 0;
        // let TLSmax = 0; 
        // let HTTPmax = 0;

        let DEBUG_TLSpayloadSize:number = 0;
        let DEBUG_HTTPtotalSize:number = 0;

        const TCPPayloadRanges:Array<Range> = new Array<Range>();
        const TLSPayloadRanges:Array<Range> = new Array<Range>();

        const HTTPStreamInfo:Map<number,any> = new Map<number,any>();

        for ( const eventRaw of this.connection.getEvents() ) {

            const event = this.connection.parseEvent( eventRaw );
            const data = event.data;

            if ( event.name === TCPEventType ){ // packet_sent or _received, the ones we want to plot

                if ( data.header.payload_length === 0 ){
                    // ack, not showing these for now
                    continue;
                }

                const length = data.header.header_length + data.header.payload_length;

                // TCP packet header
                TCPData.push({
                    index: TCPindex,
                    isPayload: false,

                    start: TCPmax,
                    size: data.header.header_length,
                });

                // TCP packet payload
                TCPData.push({
                    index: TCPindex,
                    isPayload: true,

                    start: TCPmax + data.header.header_length,
                    size: data.header.payload_length,
                });

                TCPPayloadRanges.push( {start: TCPmax + data.header.header_length, size: data.header.payload_length} );

                // TCPData.push({
                //     index: TCPindex,
                //     start: TCPmax,

                //     payload_start: TCPmax + data.header.header_length,
                //     payload_length: data.header.payload_length,

                //     total_length: data.header.payload_length,
                // });

                TCPmax += length;
                ++TCPindex;

                lastTCPEvent = data;
            }
            else if ( event.name === TLSEventType ) {

                const payloadLength = Math.max(0, data.header.payload_length);
                const recordLength = data.header.header_length + payloadLength + data.header.trailer_length;

                // console.log("Matching TLS records with TCP payload ranges", recordLength, JSON.stringify(TCPPayloadRanges));

                // each TLS record is x bytes header (typically 5 bytes), then payload, then MAC or encryption nonce (typically 16 bytes)
                const headerRanges  = this.extractRanges( TCPPayloadRanges, data.header.header_length );
                for ( const headerRange of headerRanges ) {
                    TLSData.push({
                        isPayload: false,

                        contentType: data.header.content_type,
                        index: TLSindex, 
                        tcpIndex: TCPindex - 1, // belongs to the "previous" TCP packet
                        
                        start: headerRange!.start,
                        size: headerRange.size, 

                        record_length: recordLength,
                        payload_length: payloadLength,
                    });
                }
                
                const payloadRanges = this.extractRanges( TCPPayloadRanges, payloadLength ); 
                for ( const payloadRange of payloadRanges ) {
                    TLSData.push({
                        isPayload: true,

                        contentType: data.header.content_type,
                        index: TLSindex, 
                        tcpIndex: TCPindex - 1, // belongs to the "previous" TCP packet
                        
                        start: payloadRange!.start,
                        size: payloadRange.size, 

                        record_length: recordLength,
                        payload_length: payloadLength,
                    });

                    if ( data.header.content_type === "application" ){
                        TLSPayloadRanges.push( {start: payloadRange!.start, size: payloadRange!.size} );
                        DEBUG_TLSpayloadSize += payloadRange!.size;
                    }
                }

                if ( data.header.trailer_length !== 0 ){
                    const trailerRanges = this.extractRanges( TCPPayloadRanges, data.header.trailer_length );

                    for ( const trailerRange of trailerRanges ) {
                        TLSData.push({
                            isPayload: false,

                            contentType: data.header.content_type,
                            index: TLSindex, 
                            tcpIndex: TCPindex - 1, // belongs to the "previous" TCP packet
                            
                            start: trailerRange!.start,
                            size: trailerRange.size, 

                            record_length: recordLength,
                            payload_length: payloadLength,
                        });
                    }
                }

                ++TLSindex;

                lastTLSEvent = data;
            }
            else if ( event.name === HTTPEventType ) {

                if ( data.header_length > 0 ) { // MAGIC from client doesn't have a header
                    const headerRanges = this.extractRanges( TLSPayloadRanges, data.header_length );
                    for ( const headerRange of headerRanges ) {
                        HTTPData.push({
                            isPayload: false,

                            contentType: data.content_type,
                            index: HTTPindex, 
                            tlsIndex: TLSindex - 1, // belongs to the "previous" TLS record // TODO: this is probably wrong... 

                            start: headerRange!.start,
                            size: headerRange!.size,

                            frame_length: data.header_length + data.payload_length,

                            http2frame: data,
                        });
                    }

                    DEBUG_HTTPtotalSize += data.header_length;
                }

                // some frames, like SETTINGS, don't necessarily have a payload
                if ( data.payload_length > 0 ) {
                    const payloadRanges = this.extractRanges( TLSPayloadRanges, data.payload_length );

                    for ( const payloadRange of payloadRanges ) {
                        HTTPData.push({
                            isPayload: true,

                            contentType: data.content_type,
                            index: HTTPindex, 
                            tlsIndex: TLSindex - 1, // belongs to the "previous" TLS record // TODO: this is probably wrong... 

                            start: payloadRange!.start,
                            size: payloadRange!.size,

                            frame_length: data.header_length + data.payload_length,

                            http2frame: data,
                        });
                    }

                    if ( event.data.frame && event.data.frame.frame_type === tcpqlog.HTTP2FrameTypeName.data ) {
                        const streamID = event.data.stream_id;
                        if ( streamID !== 0 ) {
                            if ( !HTTPStreamInfo.has(streamID) ) {
                                console.error("PacketizationDiagram: trying to increase payload size sum, but streamID not yet known! Potentially Server Push (which we don't support yet)", streamID, HTTPStreamInfo);
                            }
                            else {
                                HTTPStreamInfo.get( streamID ).total_size += data.payload_length;
                            }
                        }
                    }

                    DEBUG_HTTPtotalSize += data.payload_length;
                }
                else {
                    if ( data.frame.frame_type !== tcpqlog.HTTP2FrameTypeName.settings ) { // for settings, we know the server sometimes doesn't send anything
                        console.warn("Found HTTP frame without payload length... potential error?", data);
                    }
                }

                ++HTTPindex;
            }
            
            if ( event.name === HTTPHeadersSentEventType && event.data.frame.frame_type === tcpqlog.HTTP2FrameTypeName.headers ) {
                // want to link HTTP stream IDs to resource URLs that are transported over the stream
                const streamID = event.data.stream_id;
                if ( !HTTPStreamInfo.has(streamID) ) {
                    HTTPStreamInfo.set( streamID, { headers: event.data.frame.headers, total_size: 0 } );
                }
                else {
                    console.error("PacketizationDiagram: HTTPStreamInfo already had an entry for this stream", streamID, HTTPStreamInfo, event.data);
                }
            }
        }

        if ( TCPPayloadRanges.length !== 0 || TLSPayloadRanges.length !== 0 ){
            console.error( "Not all payload ranges were used up!", TCPPayloadRanges, TLSPayloadRanges);
        }

        if ( DEBUG_TLSpayloadSize !== DEBUG_HTTPtotalSize ) {
            console.error("TLS payload size != HTTP payload size", "TLS: ", DEBUG_TLSpayloadSize, "HTTP: ", DEBUG_HTTPtotalSize, "Diff : ", Math.abs(DEBUG_TLSpayloadSize - DEBUG_HTTPtotalSize) );
        }

        console.log("PacketizationDiagram: rendering data", TCPData, TLSData, HTTPData);

        const clip = this.svg.append("defs").append("SVG:clipPath")
            .attr("id", "clip")
            .append("SVG:rect")
            .attr("width", this.dimensions.width )
            .attr("height", this.dimensions.height )
            .attr("x", 0 )
            .attr("y", 0);

        const rects = this.svg.append('g')
            .attr("clip-path", "url(#clip)");


        let packetSidePadding = 0.3;

        const xDomain = d3.scaleLinear()
            .domain([0, TCPmax])
            .range([ 0, this.dimensions.width ]);

        const xAxis = this.svg.append("g");
        
        if ( this.axisLocation === "top" ) {
            xAxis
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

            let text = "TCP ";
            text += ( data.isPayload ? "Payload #" : "Header #") + data.index + " : packet size " + data.size + "<br/>";
            // text += "[" + data.offset + ", " + (data.offset + data.length - 1) + "] (size: " + data.length + ")";

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

        const recordMouseOver = (data:any, index:number) => {

            this.tooltip.transition()
                .duration(100)
                .style("opacity", .95);

            let text = "TLS ";
            text += ( data.isPayload ? "Payload #" :  (data.size > 5 ? "Trailer (MAC/auth tag/padding/content type) " : "Header #")) + data.index;
            text += " (TCP index: " + data.tcpIndex + ") : record size " + data.record_length + ", partial size " + data.size + "<br/>";
            // text += "Total record length: " + data.record_length + ", Total payload length: " + data.payload_length + "<br/>";
            text += "content type: " + data.contentType;

            this.tooltip
                .html( text )
                .style("left", (d3.event.pageX + 15) + "px")
                .style("top", (d3.event.pageY - 75) + "px");
        };

        const frameMouseOver = (data:any, index:number) => {

            this.tooltip.transition()
                .duration(100)
                .style("opacity", .95);

            let text = "H2 ";
            text += ( data.isPayload ? "Payload #" : "Header #") + " (TLS index: " + data.tlsIndex + ") : frame size " + data.http2frame.payload_length + ", partial size : " + data.size + "<br/>";
            text += "frame type: " + data.http2frame.frame.frame_type + ", streamID: " + data.http2frame.stream_id;

            const streamInfo = HTTPStreamInfo.get( data.http2frame.stream_id );
            if ( streamInfo ) {
                text += "<br/>";
                let method = "";
                let path = "";
                for ( const header of streamInfo.headers ) {
                    if ( header.name === ":method" ) {
                        method = header.value;
                    }
                    else if ( header.name === ":path" ) {
                        path = header.value;
                    }
                }
                text += "" + method + ": " + path + "<br/>";
                text += "total resource size: " + streamInfo.total_size + "<br/>";
            }

            this.tooltip
                .html( text )
                .style("left", (d3.event.pageX + 15) + "px")
                .style("top", (d3.event.pageY - 75) + "px");
        };

        const packetHeight = this.totalHeight * 0.333;
        const typeGap = this.totalHeight * 0.05;
        const typeHeight = this.totalHeight * 0.275;

        rects
            .selectAll("rect.httppacket")
            .data(HTTPData)
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(d.start) - packetSidePadding )
                .attr("y", (d:any) => packetHeight * (d.isPayload ? 0 : 0.40) )
                .attr("fill", (d:any) => (d.index % 2 === 0 ? "blue" : "lightblue") )
                .style("opacity", 1)
                .attr("class", "httppacket")
                .attr("width", (d:any) => xDomain(d.start + d.size) - xDomain(d.start) + packetSidePadding * 2)
                .attr("height", (d:any) => packetHeight * (d.isPayload ? 1 : 0.60))
                .style("pointer-events", "all")
                .on("mouseover", frameMouseOver)
                .on("mouseout", packetMouseOut)

        rects
            .selectAll("rect.tlspacket")
            .data(TLSData)
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(d.start) - packetSidePadding )
                .attr("y", (d:any) => packetHeight + packetHeight * (d.isPayload ? 0 : 0.40) )
                .attr("fill", (d:any) => (d.index % 2 === 0 ? "red" : "pink") )
                .style("opacity", 1)
                .attr("class", "tlspacket")
                .attr("width", (d:any) => xDomain(d.start + d.size) - xDomain(d.start) + packetSidePadding * 2)
                .attr("height", (d:any) => packetHeight * (d.isPayload ? 1 : 0.60))
                .style("pointer-events", "all")
                .on("mouseover", recordMouseOver)
                .on("mouseout", packetMouseOut)

        rects
            .selectAll("rect.packet")
            .data(TCPData)
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(d.start) - packetSidePadding )
                .attr("y", (d:any) => packetHeight * 2 + packetHeight * (d.isPayload ? 0 : 0.40) )
                .attr("fill", (d:any) => "" + (d.index % 2 === 0 ? "black" : "grey") )
                .attr("class", "packet")
                .attr("width", (d:any) => xDomain(d.start + d.size) - xDomain(d.start) + packetSidePadding * 2)
                .attr("height", (d:any) => packetHeight * (d.isPayload ? 1 : 0.60))
                .style("pointer-events", "all")
                .style("opacity", 1)
                // .style("opacity",(d:any) => "" + (d.index % 2 === 0 ? 0.5 : 1))
                .on("mouseover", packetMouseOver)
                .on("mouseout", packetMouseOut)
                // .on("click", (d:any) => { this.byteRangeRenderer.render(dataSent, d.streamID); });

        // legend
        this.svg.append('g')
            // text
            .append("text")
                .attr("x", xDomain(TCPmax / 2) )
                .attr("y", this.dimensions.height + this.dimensions.margin.bottom - 10 ) // + 1 is eyeballed magic number
                .attr("dominant-baseline", "baseline")
                .style("text-anchor", "middle")
                .style("font-size", "14")
                .style("font-family", "Trebuchet MS")
                // .style("font-weight", "bold")
                .attr("fill", "#000000")
                .text( "Bytes" ); 

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
                .selectAll(".packet,.tlspacket,.httppacket")
                // .transition().duration(200)
                .attr("x", (d:any) => newX(d.start) - packetSidePadding )
                // .attr("y", (d:any) => { return 50; } )
                .attr("width", (d:any) => newX(d.start + d.size) - newX(d.start) + packetSidePadding * 2)

            // this.byteRangeRenderer.zoom( newX );
        };
        
        const zoom = d3.zoom()
            .scaleExtent([1, 2000])  // This control how much you can unzoom (x0.5) and zoom (x50)
            .translateExtent([[0, 0], [this.dimensions.width, this.dimensions.height]])
            .extent([[0, 0], [this.dimensions.width, this.dimensions.height]])
            .on("zoom", updateChart);
        
        this.svg.call(zoom);

        // if ( dataSent.length > 0 ) {
        //     this.byteRangeRenderer.render( dataSent, 0 );
        // }
    }
}
