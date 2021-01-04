import QlogConnection from '@/data/Connection';
import * as qlog from '@/data/QlogSchema';
import * as d3 from 'd3';
import PacketizationDiagramDataHelper from './PacketizationDiagramDataHelper';
import PacketizationTCPPreProcessor from './PacketizationTCPPreProcessor';
import TCPToQlog from '@/components/filemanager/pcapconverter/tcptoqlog';
import { PreSpecEventParser } from '@/data/QlogLoader';
import PacketizationQUICPreProcessor from './PacketizationQUICPreProcessor';
import { PacketizationDirection } from './PacketizationDiagramModels';


export default class PacketizationDiagramD3Renderer {

    public containerID:string;
    public axisLocation:"top"|"bottom" = "bottom";

    // public svgID:string;
    public rendering:boolean = false;

    protected svg!:any;
    protected tooltip!:any;
    protected connection!:QlogConnection;
    protected direction!:PacketizationDirection;

    protected totalHeight = 100;

    private dimensions:any = {};

    constructor(containerID:string) {
        this.containerID = containerID;
    }

    public getDirection() { return this.direction; }  
   
    public async render(connection:QlogConnection, direction:PacketizationDirection ):Promise<boolean> {
        if ( this.rendering ) {
            return false;
        }

        console.log("PacketizationDiagramD3Renderer:render", connection);

        this.rendering = true;

        const canContinue:boolean = this.setup(connection, direction);

        if ( !canContinue ) {
            this.rendering = false;

            return false;
        }

        await this.renderLive();
        this.rendering = false;

        return true;
    }

    protected setup(connection:QlogConnection, direction:PacketizationDirection){
        this.connection = connection;
        this.connection.setupLookupTable();

        this.direction = direction;

        const container:HTMLElement = document.getElementById(this.containerID)!;

        this.dimensions.margin = {top: 30, right: Math.round(container.clientWidth * 0.05), bottom: 20, left: 100};
        if ( this.axisLocation === "top" ){
            this.dimensions.margin.top = 30;
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

    

    protected async renderLive() {
        console.log("Rendering packetization diagram");

        // const parser = this.connection.getEventParser();

        // want total millisecond range in this trace, so last - first
        // const xMSRange = parser.load(this.connection.getEvents()[ this.connection.getEvents().length - 1 ]).absoluteTime - 
        //                parser.load(this.connection.getEvents()[0]).absoluteTime;

        // console.log("DEBUG MS range for this trace: ", xMSRange);

        let lanes = [];

        if ( this.connection.commonFields && this.connection.commonFields.protocol_type === "TCP_HTTP2" ) {
            lanes = PacketizationTCPPreProcessor.process(this.connection, this.direction);
        }
        else { // assuming QUIC_H3
            lanes = PacketizationQUICPreProcessor.process(this.connection, this.direction);
        }


        let xMax = 0;
        if ( lanes.length > 0 && lanes[0].ranges && lanes[0].ranges.length > 0 ) {
            const bottomRanges = lanes[0].ranges;
            xMax = bottomRanges[ bottomRanges.length - 1 ].start + bottomRanges[ bottomRanges.length - 1 ].size;
        }

        console.log("PacketizationDiagram: rendering data", lanes);

        const clip = this.svg.append("defs").append("SVG:clipPath")
            .attr("id", "clip")
            .append("SVG:rect")
            .attr("width", this.dimensions.width )
            .attr("height", this.dimensions.height )
            .attr("x", 0 )
            .attr("y", 0);

        const rects = this.svg.append('g')
            .attr("clip-path", "url(#clip)");


        const packetSidePadding = 0.3;

        const xDomain = d3.scaleLinear()
            .domain([0, xMax])
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
        const mouseOver = (toString:any, data:any, index:number) => {

            this.tooltip.transition()
                .duration(100)
                .style("opacity", .95);

            const text = toString(data);

            this.tooltip
                .html( text )
                .style("left", (d3.event.pageX + 15) + "px")
                .style("top", (d3.event.pageY - 75) + "px");
        };

        const mouseOut = (data:any, index:number) => {
            this.tooltip.transition()		
                .duration(200)		
                .style("opacity", 0);	
        };

        const packetHeight = this.totalHeight * (1 / lanes.length);

        // goal: a string like ".packet,.tlspacket,.httppacket,.streampacket", to be used when zooming to select all elements at once
        const allClassNames = lanes.reduce( (prev, cur) => { prev.push( "." + cur.CSSClassName ); return prev; }, new Array<string>()).join(",");

        for ( const [index, lane] of lanes.entries() ) {

            // in the lanes array, the bottom range (e.g., TCP) is on index 0, the one above that (e.g., TLS) on index 1, etc.
            // however, when rendering, our y=0 is on the TOP left, instead of bottom left (so e.g., the Stream info need to be on index 0, TCP on index 3)
            // so we have to invert the range to accurately calculate y positions
            const yOffsetMultiplier = (lanes.length - index) - 1; // e.g., index 3 (last in a range of 4) gets: (4 - 3) - 1 = 0, which is the top of the graph, as expected

            const heightModifier = (lane.heightModifier !== undefined) ? lane.heightModifier : 1;

            rects
                .selectAll("rect." + lane.CSSClassName )
                .data(lane.ranges)
                .enter()
                .append("rect")
                    .attr("x", (d:any) => xDomain(d.start) - packetSidePadding )
                    .attr("y", (d:any) => (packetHeight * yOffsetMultiplier) + packetHeight * (d.isPayload ? 0 : 0.40) )
                    .attr("fill", (d:any) => d.color )
                    .style("opacity", 1)
                    .attr("class",  lane.CSSClassName)
                    .attr("width", (d:any) => xDomain(d.start + d.size) - xDomain(d.start) + packetSidePadding * 2)
                    .attr("height", (d:any) => heightModifier * (packetHeight * (d.isPayload ? 1 : 0.60)))
                    .style("pointer-events", "all")
                    .on("mouseover", (data:any, index:any) => { return mouseOver( lane.rangeToString, data, index ); })
                    .on("mouseout", mouseOut );

            this.svg.append('g')
                // text
                .append("text")
                    .attr("x", -5 )
                    .attr("y", (packetHeight * yOffsetMultiplier) + (packetHeight / 1.75) ) // 1.75 should be 2, but eyeballing says 1.75 is better
                    .attr("dominant-baseline", "middle")
                    .style("text-anchor", "end")
                    .style("font-size", "14")
                    .style("font-family", "Trebuchet MS")
                    .attr("fill", "#000000")
                    .text( lane.name ); 

        }

        // legend
        this.svg.append('g')
            // text
            .append("text")
                .attr("x", xDomain(xMax / 2) )
                .attr("y", this.dimensions.height + this.dimensions.margin.bottom - 10 )
                .attr("dominant-baseline", "baseline")
                .style("text-anchor", "middle")
                .style("font-size", "14")
                .style("font-family", "Trebuchet MS")
                // .style("font-weight", "bold")
                .attr("fill", "#000000")
                .text( "Bytes " + (this.direction === PacketizationDirection.sending ? "sent" : "received") ); 

        if ( lanes[0].max_size_local ) {

            const localname = (this.connection.vantagePoint && this.connection.vantagePoint.type === qlog.VantagePointType.server) ? "server" : "client";
            const remotename = (localname === "client") ? "server" : "client";

            this.svg.append('g')
                // text
                .append("text")
                    .attr("x", xDomain(xMax) - 450 )
                    .attr("y", this.dimensions.height + this.dimensions.margin.bottom - 10 )
                    .attr("dominant-baseline", "baseline")
                    .style("text-anchor", "start")
                    .style("font-size", "14")
                    .style("font-family", "Trebuchet MS")
                    // .style("font-weight", "bold")
                    .attr("fill", "#000000")
                    .text( "max receiving size " + localname + ": " + lanes[0].max_size_local );

            this.svg.append('g')
                // text
                .append("text")
                    .attr("x", xDomain(xMax) )
                    .attr("y", this.dimensions.height + this.dimensions.margin.bottom - 10 )
                    .attr("dominant-baseline", "baseline")
                    .style("text-anchor", "end")
                    .style("font-size", "14")
                    .style("font-family", "Trebuchet MS")
                    // .style("font-weight", "bold")
                    .attr("fill", "#000000")
                    .text( "max receiving size " + remotename + ": " + lanes[0].max_size_remote );
        }

        if ( lanes[0].efficiency ) {

            this.svg.append('g')
                // text
                .append("text")
                    .attr("x", xDomain(0) )
                    .attr("y", this.dimensions.height + this.dimensions.margin.bottom - 10 )
                    .attr("dominant-baseline", "baseline")
                    .style("text-anchor", "start")
                    .style("font-size", "14")
                    .style("font-family", "Trebuchet MS")
                    // .style("font-weight", "bold")
                    .attr("fill", "#000000")
                    .text( "efficiency " + (lanes[0].efficiency * 100).toFixed(2) + "%" );
        }

        let flowLabel = "";
        if ( this.connection.vantagePoint && this.connection.vantagePoint.type === qlog.VantagePointType.server ) { 
            if ( this.direction === PacketizationDirection.sending ) {
                flowLabel = "Data sent from server to client (trace vantagepoint = server)";
            }
            else {
                flowLabel = "Data received by server from client (trace vantagepoint = server)";
            }
        }
        else if ( this.connection.vantagePoint && this.connection.vantagePoint.type === qlog.VantagePointType.client ) {
            if ( this.direction === PacketizationDirection.sending ) {
                flowLabel = "Data sent from client to server (trace vantagepoint = client)";
            }
            else {
                flowLabel = "Data received by client from server (trace vantagepoint = client)";
            }
        }
        
        this.svg.append('g')
            // text
            .append("text")
                .attr("x", xDomain(xMax / 2) )
                .attr("y", -10 ) // eyeballed
                .attr("dominant-baseline", "baseline")
                .style("text-anchor", "middle")
                .style("font-size", "14")
                .style("font-family", "Trebuchet MS")
                // .style("font-weight", "bold")
                .attr("fill", "#000000")
                .text( flowLabel );

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
                .selectAll( allClassNames )
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
