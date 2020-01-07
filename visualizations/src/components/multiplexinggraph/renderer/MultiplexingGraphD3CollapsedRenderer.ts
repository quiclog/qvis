import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@quictools/qlog-schema';
import StreamGraphDataHelper from './MultiplexingGraphDataHelper';


export default class MultiplexingGraphD3CollapsedRenderer {

    public containerID:string;
    public axisLocation:"top"|"bottom" = "bottom";

    // public svgID:string;
    public rendering:boolean = false;

    protected svg!:any;
    protected connection!:QlogConnection;

    protected barHeight = 50;

    private dimensions:any = {};

    constructor(containerID:string) {
        this.containerID = containerID;
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

        this.dimensions.margin = {top: 0, right: Math.round(container.clientWidth * 0.05), bottom: 0, left: 5};
        if ( this.axisLocation === "top" ){
            this.dimensions.margin.top = 20;
        }
        else {
            this.dimensions.margin.bottom = 20;
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
        console.log("Rendering streamgraph");

        const parser = this.connection.getEventParser();

        // want total millisecond range in this trace, so last - first
        const xMSRange = parser.load(this.connection.getEvents()[ this.connection.getEvents().length - 1 ]).absoluteTime - 
                       parser.load(this.connection.getEvents()[0]).absoluteTime;

        console.log("DEBUG MS range for this trace: ", xMSRange);

        let frameCount = 1;


        let eventType = qlog.TransportEventType.packet_received;
        if ( this.connection.vantagePoint && this.connection.vantagePoint.type === qlog.VantagePointType.server ){
            eventType = qlog.TransportEventType.packet_sent;
        }

        const packets = this.connection.lookup( qlog.EventCategory.transport, eventType );

        const dataSent = [];
        for ( const packetRaw of packets ) {
            const packet = this.connection.parseEvent( packetRaw );
            const data = packet.data;
            if ( data.frames && data.frames.length > 0 ){
                for ( const frame of data.frames ) {

                    if ( !frame.stream_id || !StreamGraphDataHelper.isDataStream( frame.stream_id )){
                        // skip control streams like QPACK
                        continue;
                    }

                    if ( frame.frame_type && frame.frame_type === qlog.QUICFrameTypeName.stream ){
                        dataSent.push( {streamID: frame.stream_id, size: frame.length, countStart: frameCount, countEnd: frameCount + 1 } );
                        ++frameCount;
                    }
                }
            }
        }

        const xDomain = d3.scaleLinear()
            .domain([1, frameCount])
            .range([ 0, this.dimensions.width ]);

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


        console.log("DEBUG: dataSent", dataSent);

        const colorDomain = d3.scaleOrdinal() 
            .domain(["1", "2", "3", "5", "6", "7",                                                                    "0",   "4",     "8",    "12",   "16",     "20",     "24",     "28",    "32",   "36",    "40",  "44"])
            .range([ "lavenderblush","lavenderblush","lavenderblush","lavenderblush","lavenderblush","lavenderblush", "red", "green", "blue", "pink", "purple", "yellow", "indigo", "black", "grey", "brown", "cyan", "orange"]);



        // console.log("IDs present ", dataSent.map( (d) => d.streamID).filter((item, i, ar) => ar.indexOf(item) === i));

        const clip = this.svg.append("defs").append("SVG:clipPath")
            .attr("id", "clip")
            .append("SVG:rect")
            .attr("width", this.dimensions.width )
            .attr("height", this.dimensions.height )
            .attr("x", 0)
            .attr("y", 0);

        const rects = this.svg.append('g')
            .attr("clip-path", "url(#clip)");

        rects
            .selectAll("rect")
            .data(dataSent)
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(d.countStart) - 0.15 )
                .attr("y", (d:any) => 0 )
                .attr("fill", (d:any) => "" + colorDomain( "" + d.streamID ) )
                .style("opacity", 1)
                .attr("class", "packet")
                .attr("width", (d:any) => xDomain(d.countEnd) - xDomain(d.countStart) + 0.3)
                .attr("height", this.barHeight);

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

            // update circle position
            rects
                .selectAll(".packet")
                // .transition().duration(200)
                .attr("x", (d:any) => newX(d.countStart) - 0.15 )
                // .attr("y", (d:any) => { return 50; } )
                .attr("width", (d:any) => newX(d.countEnd) - newX(d.countStart) + 0.3)
        };

        const zoom = d3.zoom()
            .scaleExtent([1, 20])  // This control how much you can unzoom (x0.5) and zoom (x20)
            .translateExtent([[0, 0], [this.dimensions.width, this.dimensions.height]])
            .extent([[0, 0], [this.dimensions.width, this.dimensions.height]])
            .on("zoom", updateChart);

        // This add an invisible rect on top of the chart area. This rect can recover pointer events: necessary to understand when the user zoom
        this.svg.append("rect")
            .attr("width", this.dimensions.width)
            .attr("height", this.dimensions.height)
            .style("fill", "none")
            .style("pointer-events", "all")
            // .attr('transform', 'translate(' + 0 + ',' + this.dimensions.margin.top + ')')
            .call(zoom);
    }

}
