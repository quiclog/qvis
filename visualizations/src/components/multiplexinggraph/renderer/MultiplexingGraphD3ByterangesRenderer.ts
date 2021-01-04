import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@/data/QlogSchema';
import StreamGraphDataHelper from './MultiplexingGraphDataHelper';


export default class MultiplexingGraphD3ByterangesRenderer {

    public containerID:string;

    public rendering:boolean = false;
    protected svg!:any;
    protected connection!:QlogConnection;

    protected height = 500;

    private dimensions:any = {};

    private updateZoom:any;

    constructor(containerID:string) {
        this.containerID = containerID;
    }
   
    public async render( allFrames:Array<any>, allDataMoved:Array<any>, streamID:number ):Promise<boolean> {
        if ( this.rendering ) {
            return false;
        }

        console.log("MultiplexingGraphD3ByterangesRenderer:render", streamID);

        this.rendering = true;

        const canContinue:boolean = this.setup();

        if ( !canContinue ) {
            this.rendering = false;

            return false;
        }

        await this.renderLive( allFrames, allDataMoved, streamID );
        this.rendering = false;

        return true;
    }

    public zoom(newXDomain:any) {
        this.updateZoom( newXDomain );
    }

    protected setup() {

        const container:HTMLElement = document.getElementById(this.containerID)!;

        this.dimensions.margin = {top: 20, right: 40, bottom: 20, left: 20};

        // width and height are the INTERNAL widths (so without the margins)
        this.dimensions.width = container.clientWidth - this.dimensions.margin.left - this.dimensions.margin.right;
        this.dimensions.height = this.height;


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

    protected async renderLive( allFrames:Array<any>, allDataMoved:Array<any>, streamID:number ) {
        console.log("Rendering multiplexing byteranges graph", streamID);

        const streamFrames = allFrames.filter( (d:any) => "" + d.streamID === "" + streamID );
        const dataMoved = allDataMoved.filter( (d:any) => "" + d.streamID === "" + streamID );

        // final frame isn't necessarily the last one in the file, due to retransmits
        // so we need to actually search for the largest one
        let maxBytes = 0;
        for ( const frame of streamFrames ) {
            const max = frame.offset + frame.length - 1;
            if ( max > maxBytes ){
                maxBytes = max;
            }
        }
        
        const xDomain = d3.scaleLinear()
            .domain([1, allFrames[ allFrames.length - 1 ].countEnd ])
            .range([ 0, this.dimensions.width ]);


        const xAxis = this.svg.append("g");
        xAxis.call(d3.axisTop(xDomain));

        const yDomain = d3.scaleLinear()
            .domain([0, maxBytes ])
            // .domain([0, 200000 ])
            // .range([this.dimensions.height, 0]);
            .range([0, this.dimensions.height]);

        const yAxis = this.svg.append("g")
            .attr("transform", "translate(0, 0)");

        yAxis.call(d3.axisRight(yDomain));

        const clip = this.svg.append("defs").append("SVG:clipPath")
            .attr("id", "byterange-clip")
            .append("SVG:rect")
            .attr("width", this.dimensions.width )
            .attr("height", this.dimensions.height )
            .attr("x", 0 )
            .attr("y", 0);


        const packetSidePadding = 0.3;

        const rects = this.svg.append('g')
            .attr("clip-path", "url(#byterange-clip)");

        const widthModifier = 1;
        const heightModifier = 1;

        rects
            .selectAll("rect.packet")
            .data( streamFrames )
            .enter()
            .append("rect")
                .attr("x", (d:any) => { return xDomain(d.countStart); } )
                .attr("y", (d:any) => yDomain(d.offset) )
                .attr("fill", (d:any) => StreamGraphDataHelper.StreamIDToColor("" + d.streamID)[0] )
                .style("opacity", 1)
                .attr("class", "packet")
                .attr("width", (d:any) => Math.max(1, xDomain(d.countEnd) - xDomain(d.countStart)) * widthModifier)
                .attr("height", (d:any) => Math.max(1, yDomain( d.length - 1)) * heightModifier)

        const opacity = 0.2;
        rects
            .selectAll("rect.pingback")
            .data( streamFrames )
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(1) )
                .attr("y", (d:any) => yDomain(d.offset) )
                .attr("fill", (d:any) => StreamGraphDataHelper.StreamIDToColor("" + d.streamID)[0] )
                .style("opacity", opacity)
                .attr("class", "pingback")
                .attr("width", (d:any) => Math.max(1, xDomain(d.countEnd) - xDomain(1)))
                .attr("height", (d:any) => yDomain( d.length - 1))
            // .style("pointer-events", "all")

        const movedOffset = 1;
        rects
            .selectAll("rect.dataMoved")
            .data( dataMoved )
            .enter()
            .append("rect")
                .attr("x", (d:any) => xDomain(d.countStart + movedOffset) )
                .attr("y", (d:any) => yDomain(d.offset) )
                .attr("fill", "black" )
                .style("opacity", 1)
                .attr("class", "dataMoved")
                .attr("width", (d:any) => Math.max(1, xDomain(d.countEnd) - xDomain(d.countStart)) * widthModifier)
                .attr("height", (d:any) => yDomain( d.offset + d.length - 1) - yDomain(d.offset));

        this.updateZoom = (newXDomain:any) => {

            // recover the new scale
            const newX = newXDomain; // d3.event.transform.rescaleX(xDomain);

            // nicely stays within indexes!
            const startIndex = Math.max(0, Math.ceil(newX.domain()[0]) + 1);
            const endIndex   = Math.min( allFrames.length - 1, Math.floor(newX.domain()[1]) - 1);

            if ( endIndex > allFrames.length ) {
                console.error("Something went wrong transforming Y domain byterangeszoom", endIndex, allFrames.length );
            }

            // console.log("Looking for Y values between", startIndex, endIndex);

            let startY:number = Number.MAX_VALUE;
            let endY:number = 0;

            // TODO: first frame we find doesn't necessarily have the lowest offset... need to loop through the entire range and find lowest offset... auch

            for ( let i = startIndex; i < endIndex; ++i ){
                const frame = allFrames[i];
                if ( "" + frame.streamID === "" + streamID ) {
                    // console.log("Found frame for stream at index ",i, " with offset ", frame.offset, frame );
                    if ( frame.offset < startY ) {
                        startY = parseInt(frame.offset, 0);
                    }
                }
            }

            for ( let i = endIndex; i > startIndex; --i ) {
                const frame = allFrames[i];
                if ( !frame ){
                    // console.error("Frame at index ", i, "Couldn't be found... weird");
                    continue;
                }

                if ( "" + frame.streamID === "" + streamID ) {
                    if ( parseInt(frame.offset, 10) + parseInt(frame.length, 10) - 1 > endY ) {
                        endY = parseInt(frame.offset, 0) + parseInt(frame.length, 10) - 1;
                    }
                }
            }

            // console.log("Y new domain", startY, endY);
            if ( startY > endY ) {
                console.error("Something went terribly wrong", startY, endY);
            }

            const newY = yDomain.copy().domain( [startY, endY] );


            xAxis.call(d3.axisTop(newX));
            yAxis.call(d3.axisLeft(newY));

            // update position
            rects
                .selectAll(".packet")
                .attr("x", (d:any) => newX(d.countStart) )
                .attr("width", (d:any) => Math.max(1, newX(d.countEnd) - newX(d.countStart)))
                .attr("y", (d:any) => newY(d.offset) )
                .attr("height", (d:any) => Math.max(1, newY( d.offset + d.length - 1) - newY( d.offset )) )

            
            rects
                .selectAll(".pingback")
                .attr("x", (d:any) => newX(1) )
                .attr("width", (d:any) => newX(d.countEnd) - newX(1) )
                .attr("y", (d:any) => newY(d.offset) )
                .attr("height", (d:any) => { return newY( d.offset + d.length - 1) - newY(d.offset);} )


            rects
                .selectAll(".dataMoved")
                    .attr("x",      (d:any) => newX(d.countStart + movedOffset) )
                    .attr("width",  (d:any) => Math.max(1, newX(d.countEnd) - newX(d.countStart)) )
                    .attr("y",      (d:any) => newY( d.offset ) )
                    .attr("height", (d:any) => { return newY( d.offset + d.length - 1) - newY(d.offset); } )
        };
    }
}
