import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@/data/QlogSchema';
import StreamGraphDataHelper from './MultiplexingGraphDataHelper';


export default class MultiplexingGraphD3SimulationRenderer {

    public containerID:string;

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

        console.log("MultiplexingGraphD3SimulationRenderer:render", connection);

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

        this.dimensions.margin = {top: 20, right: Math.round(container.clientWidth * 0.05), bottom: 0, left: 5};

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
        console.log("Rendering streamgraphrequests");

        const parser = this.connection.getEventParser();

        // want total millisecond range in this trace, so last - first
        const xMSRange = parser.load(this.connection.getEvents()[ this.connection.getEvents().length - 1 ]).absoluteTime - 
                       parser.load(this.connection.getEvents()[0]).absoluteTime;

        console.log("DEBUG MS range for this trace: ", xMSRange);

        let requestCount = 1;

        let eventType = qlog.HTTP3EventType.frame_created;
        if ( this.connection.vantagePoint && this.connection.vantagePoint.type === qlog.VantagePointType.server ){
            eventType = qlog.HTTP3EventType.frame_parsed;
        }

        const frames = this.connection.lookup( qlog.EventCategory.http, eventType );

        const requestsSent = [];
        for ( const eventRaw of frames ) {
            const evt = this.connection.parseEvent( eventRaw );
            const data = evt.data;

            if ( !data.frame || data.frame.frame_type !== qlog.HTTP3FrameTypeName.headers ) {
                continue;
            }

            if ( !StreamGraphDataHelper.isDataStream( "" + data.stream_id )) {
                // skip control streams like QPACK
                continue;
            }

            let method = undefined;
            let path = undefined;
            for ( const header of data.frame.headers ){
                if ( header.name === ":method" ){
                    method = header.value;
                }
                if ( header.name === ":path" ){
                    path = header.value;
                }
            }

            requestsSent.push( {streamID: data.stream_id, count: requestCount, text: method + " " + path } );
            ++requestCount;
        }

        // TODO: what if no H3-level stuff found?!

        const xDomain = d3.scaleLinear()
            .domain([1, requestCount])
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


        console.log("DEBUG: requestsSent", requestsSent);

        // let colorDomain = d3.scaleOrdinal() 
        //     .domain(["0",   "4",     "8",    "12",   "16",     "20",     "24",     "28",    "32",   "36",    "40",  "44"])
        //     .range([ "red", "green", "blue", "pink", "purple", "yellow", "indigo", "black", "grey", "brown", "cyan", "orange"]);

        const clip = this.svg.append("defs").append("SVG:clipPath")
            .attr("id", "clip")
            .append("SVG:rect")
            .attr("width", this.dimensions.width )
            .attr("height", this.dimensions.height )
            .attr("x", 0)
            .attr("y", 0);

        const rects = this.svg.append('g')
            .attr("clip-path", "url(#clip)");

        const rects2 = rects
            .selectAll("rect")
            .data(requestsSent)
            .enter()
            .append("g");


        rects2
            // background
            .append("rect")
                .attr("x", (d:any) => { return xDomain(d.count) - 0.15; } )
                .attr("y", (d:any) => { return 0; } )
                // .attr("fill", (d:any) => { return "" + colorDomain( "" + d.streamID ); } )
                .attr("fill", (d:any) => { return StreamGraphDataHelper.StreamIDToColor("" + d.streamID)[0]; } )
                .style("opacity", 1)
                .attr("class", "packet")
                .attr("width", (d:any) => { return xDomain(d.count + 1) - xDomain(d.count)  + 0.3; })
                .attr("height", this.barHeight);
            // .insert("rect")
            //     .attr("x", (d:any) => { return xDomain(d.count) + 15; } )
            //     .attr("y", (d:any) => { return 15; } )
            //     .attr("fill", "#FFFFFF" )
            //     .style("opacity", 0.75)
            //     .attr("width", (d:any) => { return xDomain(d.count + 1) - xDomain(d.count) - 15; })
            //     .attr("height", this.barHeight * 0.2 );

        rects2
            // .selectAll("rect")
            // .data(requestsSent)
            // .enter()
            // textbox
            .append("rect")
                .attr("x", (d:any) => { return xDomain(d.count) + 15; } )
                .attr("y", (d:any) => { return 15; } )
                .attr("fill", "#FFFFFF" )
                .style("opacity", 0.75)
                .attr("width", (d:any) => { return xDomain(d.count + 1) - xDomain(d.count) - 30; })
                .attr("height", this.barHeight * 0.4 );

        rects2
            // text
            .append("text")
                .attr("x", (d:any) => { return xDomain(d.count) + 15 + 2; } )
                .attr("y", (d:any) => { return 15 + ((this.barHeight * 0.4) / 2); } )
                .attr("dominant-baseline", "middle")
                .style("text-anchor", "start")
                .style("font-size", "14")
                .style("font-family", "Trebuchet MS")
                .style("font-weight", "bold")
                .attr("fill", "#000000")
                .text( (d:any) => { return d.text; } );


        // const updateChart = () => {

        //     // recover the new scale
        //     const newX = d3.event.transform.rescaleX(xDomain);

        //     // update axes with these new boundaries
        //     // xAxis./*transition().duration(200).*/call(d3.axisBottom(newX));
        //     // if ( this.axisLocation === "top" ){
        //     //     xAxis.call(d3.axisTop(newX));
        //     // }
        //     // else {
        //     //     xAxis.call(d3.axisBottom(newX));
        //     // }

        //     // update circle position
        //     rects
        //         .selectAll(".packet")
        //         // .transition().duration(200)
        //         .attr("x", (d:any) => { return newX(d.count) - 0.15; } )
        //         // .attr("y", (d:any) => { return 50; } )
        //         .attr("width", (d:any) => { return xDomain(1) + 0.3; })
        // };

        // const zoom = d3.zoom()
        //     .scaleExtent([1, 20])  // This control how much you can unzoom (x0.5) and zoom (x20)
        //     .translateExtent([[0, 0], [this.dimensions.width, this.dimensions.height]])
        //     .extent([[0, 0], [this.dimensions.width, this.dimensions.height]])
        //     .on("zoom", updateChart);

        // // This add an invisible rect on top of the chart area. This rect can recover pointer events: necessary to understand when the user zoom
        // this.svg.append("rect")
        //     .attr("width", this.dimensions.width)
        //     .attr("height", this.dimensions.height)
        //     .style("fill", "none")
        //     .style("pointer-events", "all")
        //     // .attr('transform', 'translate(' + 0 + ',' + this.dimensions.margin.top + ')')
        //     .call(zoom);
    }

}
