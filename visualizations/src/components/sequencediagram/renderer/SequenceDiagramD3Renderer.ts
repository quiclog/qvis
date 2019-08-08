import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@quictools/qlog-schema';

interface VerticalRange {
    svgGroup:HTMLOrSVGElement | undefined,
    rendered: boolean,
    yMin: number
};

interface ExtentInfo {
    rangeIndex: number,
    start: number,
    stop: number
};

export default class SequenceDiagramD3Renderer {

    public containerID:string;
    public svgID:string;
    public rendering:boolean = false;

    private svg!:d3.Selection<d3.BaseType, unknown, HTMLElement, any>;

    private traces!:Array<QlogConnection>;

    private scrollHandler:((e:any) => void) | undefined = undefined;

    
    private renderedRanges!:Array<VerticalRange>;
    private rangeHeight!:number;
    
    private bandWidth:number = 0; // width of an individual vertical trace timeline on screen

    constructor(containerID:string, svgID:string){
        this.containerID = containerID;
        this.svgID = svgID;
    }
   
    public render(traces:Array<QlogConnection>) {
        if ( this.rendering ) {
            return;
        }

        console.log("SequenceDiagramRenderer:render", traces);

        this.rendering = true;

        // To make things performant enough, we don't render the full diagram at once
        // We always render just parts of it at the same time
        // this.setup prepares everything, calculates coordinates and relations between events etc.
        // this.renderPartialExtents can then be called on scroll updates. It figures out which part of the SVG is visible and makes sure that part of the diagram is drawn.
        const canContinue:boolean = this.setup(traces);

        if ( !canContinue ) {
            this.rendering = false;

            return;
        }

        this.renderPartialExtents().then( () => {
            this.rendering = false;
        });
    }

    // runs once before each render. Used to bootstrap everything.
    protected setup(tracesInput:Array<QlogConnection>):boolean {

        // 0. make sure the containers exist
        // 1. make sure we have at least 2 traces to draw (sequence diagram doesn't make much sense with just one)
        // 2. calculate the y coordinates for each event on the timelines. This can be done once and stored for future use
        // 3. setup the SVG container and draw things like timelines
        // 4. prepare data structures to keep scrolling state (what we've drawn already and what not yet)
        // 5. setup event listeners so we can update the rendering when needed

        // 0.
        if ( document.getElementById(this.containerID) === undefined ){
            console.error("SequenceDiagramD3Renderer:setup : container element not found, cannot render!", this.containerID);

            return false;
        }

        if ( document.getElementById(this.svgID) === undefined ){
            console.error("SequenceDiagramD3Renderer:setup : svg element not found, cannot render!", this.svgID);

            return false;
        }

        // 1.
        this.traces = new Array<QlogConnection>();
        // new array, because a) we might want to add a trace if there's only 1 and b) we might have invalid traces in there
        for (const trace of tracesInput) {
            if ( trace.getEvents().length > 0 ){
                this.traces.push( trace );
            }
        }

        if ( this.traces.length === 0 ){
            console.error("SequenceDiagramD3Renderer:setup : None of the selected traces have events in them, cannot render");

            return false;
        }

        this.ensureMoreThanOneTrace( this.traces );

        // 2. 
        const maxY = this.calculateCoordinates( this.traces );

        // TODO: verify traces are left-to-right : i.e., arrows do not go UP!

        // 3. 
        const container:HTMLElement = document.getElementById(this.containerID)!;

        this.svg = d3.select("body").select( "#" + this.svgID );
        this.svg.selectAll("*").remove();
       
        this.svg.attr("height", maxY);
        // this is impacted by whether we have scrollbars or not, so we set height first before fetching this
        const containerWidth:number = container.clientWidth;
        this.svg.attr("width", containerWidth);
        this.svg.attr("viewbox", `0 0 ${containerWidth} ${maxY}`);
        
        // draw the vertical timelines 
        // we have multiple timelines next to each other in horizontal "bands"
        this.bandWidth = (containerWidth / this.traces.length);
        for ( let i = 0; i < this.traces.length; ++i ){
            const currentX =  this.bandWidth * i + (this.bandWidth * 0.5); // get center of the band

            this.svg.append('rect').attr("x", currentX).attr("y", 0).attr("width", 2).attr("height", maxY).attr("fill", "black");
        }

        // 4.

        // we want to keep track of which areas of the SVG we've drawn already (since we don't want to draw all at once and want to clear some afterwards)
        // we divide the entire SVG in vertical "ranges" that are 1 screen height large, then for example make sure there are always at least 3 or 4 of them drawn
        // In the scroll handler, we can use the rangeHeight to determine which of the ranges is currently "in view"
        // Here, we just prepare the range structs for later use
        this.rangeHeight = screen.height;
        this.renderedRanges = new Array<VerticalRange>();

        let currentRangeY = 0;
        let currentRangeIndex = 0;
        while ( currentRangeY < maxY ){
            this.renderedRanges[currentRangeIndex] = {
                rendered: false,
                svgGroup: undefined,
                yMin: currentRangeY,
            }

            currentRangeY += this.rangeHeight;
            ++currentRangeIndex;
        }

        // 5.
        if ( this.scrollHandler !== undefined ){
            window.removeEventListener("scroll", this.scrollHandler);
            this.scrollHandler = undefined;
        }

        // scroll events are fired very quickly sometimes, don't want to try and render for each of them
        // we only fire on each 5th event but also add a timeout (typical "debounce"-alike) to make sure the final event gets used
        let scrollEventCount:number = 0;
        let scrollTimer:number | undefined = undefined;
        this.scrollHandler = (e) => {
           
           const execute = () => {
               scrollTimer = undefined;
               this.renderPartialExtents();
           };

           clearTimeout( scrollTimer );
           scrollTimer = setTimeout( execute, 250 ); // 250 ms

           ++scrollEventCount;
           if ( scrollEventCount % 5 === 0 ){ // 5 = magic number, from experimental experience in chrome, very scientific
               scrollEventCount = 0;
               clearTimeout( scrollTimer );
               execute();
           } 
       }

        window.addEventListener('scroll', this.scrollHandler);

        // TODO: also couple to window resize events? That should possibly trigger a full re-render, since the SVG can have changed width

        return true;
    }

    protected ensureMoreThanOneTrace(traces:Array<QlogConnection>) {

        if ( traces.length > 1 ){
            return;
        }

        if ( traces[0].parent.getConnections().length > 1 ){
            // traces.length is currently just 1, so we need to add its next sibling automatically as trace here 
            traces.push( traces[0].parent.getConnections()[1] );
            
            return;
        }

        // we cannot just visualize a single trace on a sequence diagram...
        // so we copy the trace and pretend like the copy is one from the other side
        const newTrace = traces[0].clone();
        newTrace.title = "Cloned trace : " + newTrace.title;
        newTrace.description = "Cloned trace : " + newTrace.description;

        // we have a single trace, we need to copy it so we can simulate client + server
        if ( traces[0].vantagePoint.type === qlog.VantagePointType.server || 
             traces[0].vantagePoint.flow === qlog.VantagePointType.server ){
            newTrace.vantagePoint.type = qlog.VantagePointType.client;
            traces.unshift( newTrace );
        }
        else if ( traces[0].vantagePoint.type === qlog.VantagePointType.client || 
                  traces[0].vantagePoint.flow === qlog.VantagePointType.client ){
            newTrace.vantagePoint.type = qlog.VantagePointType.server;
            traces.push( newTrace );
        }

        for ( const event of newTrace.getEvents() ){
            const type = newTrace.parseEvent(event).name;
            if ( type === qlog.TransportEventType.packet_sent ){
                newTrace.parseEvent(event).name = qlog.TransportEventType.packet_received;
            }
            if ( type === qlog.TransportEventType.packet_received ){
                newTrace.parseEvent(event).name = qlog.TransportEventType.packet_sent;
            }

            // TODO: are there other events that should be changed? probably some that should be filtered out? e.g., all non transport/H3-related things? 
        }
    }

    protected createPrivateNamespace(obj:any):void {
        if ( obj.qvis === undefined ) {
            Object.defineProperty(obj, "qvis", { enumerable: false, value: {} });
        }

        if ( obj.qvis.sequencediagram === undefined ) {
            obj.qvis.sequencediagram = {};
        }
    }

    protected calculateCoordinates(traces:Array<QlogConnection>):number {

        const pixelsPerMillisecond = 10;

        // we perform a naive online k-way merge to process the events in their timestamp order
        // https://en.wikipedia.org/wiki/K-way_merge_algorithm
        const heads:Array<number> = new Array<number>( traces.length ).fill(0); // points to the current index of each trace we're looking at
        let doneCount = 0;

        // for ( let t = 0; t < traces.length; ++t ){
        //     const trace:any = traces[t];
        //     if ( trace.qvis && trace.qvis.sequencediagram && trace.qvis.sequencediagram.coordinatesCalculated ){
        //         heads[t] = -1;
        //         ++doneCount;
        //     }
        //     else {
        //         this.createPrivateNamespace(trace);
        //         (trace as any).qvis.sequencediagram.coordinatesCalculated = true;
        //     }
        // }

        let done = false;
        // done = doneCount === traces.length;

        // if ( done ) {
        //     return (traces[0] as any).qvis.sequencediagram.maxY;
        // }

        let maxY = 0;

        while ( !done ) {
            let currentMinimumTrace:number = -1;
            let currentMinimumValue:number = Number.MAX_VALUE;
            let currentMinimumEvent:any;

            for ( let t = 0; t < traces.length; ++t ){
                if ( heads[t] === -1 ) { // means that array has been processed completely
                    continue;
                }

                const evt = traces[t].getEvents()[ heads[t] ];
                const time = traces[t].parseEvent(evt).time;
                
                if ( time < currentMinimumValue ){
                    currentMinimumTrace = t;
                    currentMinimumValue = time;
                    currentMinimumEvent = evt;
                }
            }

            // TODO: calculate coordinate for the current minimum
            // TODO: what happens with identical timestamps? should favor single trace, right?
            this.createPrivateNamespace(currentMinimumEvent);
            (currentMinimumEvent as any).qvis.sequencediagram.y = traces[currentMinimumTrace].parseEvent(currentMinimumEvent).time * pixelsPerMillisecond;

            // console.log("Next event was : ", (currentMinimumEvent as any).qvis.sequencediagram.y, currentMinimumTrace, currentMinimumValue);

            heads[ currentMinimumTrace ] += 1;
            if ( heads[currentMinimumTrace] >= traces[currentMinimumTrace].getEvents().length ) {
                heads[ currentMinimumTrace ] = -1;
                ++doneCount;
            }

            done = doneCount === traces.length;

            maxY = (currentMinimumEvent as any).qvis.sequencediagram.y;
        }

        // let DEBUG_penultimateEvent = traces[0].getEvents()[ traces[0].getEvents().length - 1 ];
        // let DEBUG_lastEvent = DEBUG_penultimateEvent.slice();
        // this.createPrivateNamespace( DEBUG_lastEvent );
        // (DEBUG_lastEvent as any).qvis.sequencediagram.y = (DEBUG_penultimateEvent as any).qvis.sequencediagram.y + 1000;
        // traces[0].getEvents().push( DEBUG_lastEvent );
        // maxY += 1000;


        maxY += 100; // give a bit of breathing room at the bottom of the diagram

        return maxY;
    }

    protected async renderPartialExtents(){

        // About rendering performance:
        // - simply using d3 directly and creating all the svg shapes in 1 big loop is very slow for large files (>10s)
        //      - main bottlenecks are Major GCs (apparently .appendChild and .createElement creates tons of garbage...) but also "recalculate style" and "layout"
        //      - adding elements to an svg element that is already in the DOM tree is slower than adding them to a sepate svg element (via d3.create) but not much
        //      - adding elements in a time-sliced way (e.g., pause 100ms after every 2000 events) works, but we still see very high reflow/layout costs (>200ms per batch)
        //      - using documentFragment does nothing (very similar to adding to an SVG that's not in the DOM tree yet)
        // - doing svg elements without d3: is somewhat faster (say 8s -> 6s) and seems to induce less garbage collection: recommended
        // - doing canvas : just 1s to draw and render everything... there's really no competition

        // HOWEVER: canvas does not allow us to interact with individual elements directly and is not scalable
        // while both these problems can be solved, it would take much time. 
        // As such, we reserve the canvas method for visualizations that really -need- to draw that many objects at once (e.g., the congestion diagram)
        // For diagrams such as the sequence timelines, we will never be showing everything at once, so we can get by with drawing only the visible parts at a time
        // The following implementation only draws the current viewport + the ones above and below it (for smoother scrolling)
        // Next to this, it actively removes/un-renders old data. This is because on eof the main bottlenecks is the "recalculate style" and "layout" steps from the browser
        // These scale super-linearly with the amount of objects in the DOM (not just the newly added ones) so we need to keep the total amount down to remove that bottleneck

        // TODO: add a "save to SVG" option that -does- draw everything at once (at the cost of the user having to wait a while)


        // 1. determine which areas to render and which to un-render
        // 2. un-render the proper ranges
        // 3. render the proper ranges

        const svg = this.svg;

        // 1. 

        // want to calculate to the visible area of our svg
        // this turned out to be quite non-trivial... there is no default API for this
        // - would be easy of we're always filling the screen and our element is the only one: yMin = window.pageYOffset ( = basically scrollTop)
        // - however, our element is in some container, so we need to calculate how far down we are (offsetFromDocumentTop) and take that into account.
        //   -> this becomes interesting, because as we scroll, we scroll fully into view with our svg, 
        //      so that's why we use Math.max: as soon as the offset is negative, means we are fully into the viewport)
        // - then, calculating yMax, we need to again take into account that we don't always fill the entire screen: cannot just do yMin + window.innerHeight
        //   -> we use Math.max again: when svgRect.top becomes negative, we're screen filling, so we default to the full height
        const svgRect = (svg.node()! as Element).getBoundingClientRect();
        const offsetFromDocumentTop = svgRect.top - document.body.getBoundingClientRect().top;
        const yMin = Math.max(0, window.pageYOffset - offsetFromDocumentTop);
        const yMax = yMin + (window.innerHeight - Math.max(0, svgRect.top));

        // see if we need to render ranges at this time
        const currentRangeIndex = Math.floor(yMin / this.rangeHeight);
        const fromRange         = Math.max(0,                              currentRangeIndex - 1);
        const toRange           = Math.min(this.renderedRanges.length - 1, currentRangeIndex + 1);

        // we need to go from ranges to actual [yMin, yMax] "extents" that we can render
        const extentsToRender:Array< ExtentInfo > = new Array< ExtentInfo >();

        // TODO: do we really need ExtentInfo? why not just store the stop in the range and keep array of ranges?
        for ( let r = fromRange; r <= toRange; ++r ){
            if ( !this.renderedRanges[r].rendered ){
                extentsToRender.push( { rangeIndex: r, start: this.renderedRanges[r].yMin, stop: this.renderedRanges[r].yMin + this.rangeHeight - 1} ); // -1 to prevent overlap with next range
            }
        }

        // see if we need to un-render ranges at this time
        const rangeIndicesToRemove:Array< number > = new Array< number >();
        // first determine the lower indices
        let removeFrom:number = Math.max(0, fromRange - 500);
        let removeTo:number   = Math.max(0, fromRange - 2); // leave 1 extra buffer of rendered range
        if ( !(removeFrom === 0 && removeTo === 0) ){ // don't want to remove range 0 if it's the only one
            for ( let r = removeFrom; r <= removeTo; ++r ){
                if ( this.renderedRanges[r].rendered ){
                    rangeIndicesToRemove.push( r );
                }
            }
        }
        // then the higher indices (when scrolling back up)
        removeFrom  = Math.min(this.renderedRanges.length - 1, toRange + 2); // leave 1 extra buffer of rendered range
        removeTo    = Math.min(this.renderedRanges.length - 1, toRange + 500);
        if ( !(removeFrom === this.renderedRanges.length - 1 && removeTo === this.renderedRanges.length - 1) ){ // don't want to remove the last range if it's the only one
            for ( let r = removeFrom; r <= removeTo; ++r ){
                if ( this.renderedRanges[r].rendered ){
                    rangeIndicesToRemove.push( r );
                }
            }
        }

        // 2. 
        if ( rangeIndicesToRemove.length >= 1 ){
            // console.log("rangesToRemove", currentRangeIndex, rangeIndicesToRemove);

            // when rendering, we group all elements of a single range/extent together in 1 group (range.svgGroup)
            for ( const rangeIndex of rangeIndicesToRemove ) {
                const rangeSvgGroup = this.renderedRanges[rangeIndex].svgGroup;
                // console.log("Removing", rangeSvgGroup, (rangeSvgGroup as any).parentNode);

                (rangeSvgGroup as any).parentNode.removeChild( rangeSvgGroup );

                this.renderedRanges[rangeIndex].svgGroup = undefined;
                this.renderedRanges[rangeIndex].rendered = false;
            }
        }

        // nothing new to render, so we can stop
        // can happen e.g., if user only scrolls small area
        if ( extentsToRender.length === 0 ){
            return;
        }

        // 3.


        // console.log("Actual coordinates to render", extentsToRender);

        /*
        const svg = d3.create("svg").attr("id", this.svgID);
        svg.attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
            .attr("font-family", "Trebuchet MS");
        */



        const output = '';

        for ( const extent of extentsToRender ){

            const extentContainer = document.createElementNS("http://www.w3.org/2000/svg", "g");
            this.renderedRanges[extent.rangeIndex].svgGroup = extentContainer;
            this.renderedRanges[extent.rangeIndex].rendered = true;

            for ( let i = 0; i < this.traces.length; ++i ){
                const trace = this.traces[i];
                const currentX = this.bandWidth * i + (this.bandWidth * 0.5); // center of the horizontal band

                const events = trace.getEvents();
                
                let currentY = 0;
                for ( const evt of events ){
                    currentY = (evt as any).qvis.sequencediagram.y;

                    if ( currentY < extent.start ) {
                        continue;
                    }

                    if ( currentY > extent.stop ) {
                        break;
                    }

                    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    rect.setAttribute('x', "" + currentX);
                    rect.setAttribute('y', "" + currentY);
                    rect.setAttribute('width', "10");
                    rect.setAttribute('height', "10");
                    rect.setAttribute('fill', 'green');
                    rect.onclick = (evt_in) => { alert("Clicked on " + ((evt as any).qvis.sequencediagram.y)); };
                    extentContainer.appendChild( rect );


                    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    text.setAttribute('x', "" + currentX + 10);
                    text.setAttribute('y', "" + currentY);
                    text.textContent = "" + currentY;
                    extentContainer.appendChild( text );

                    // svg.append('rect').attr('x', currentX).attr('y', currentY).attr('width', 10).attr('height', 2).attr('fill', 'green');
                    // svg.append('text').attr('x', currentX + 10).attr('y', currentY).text( currentY );

                    // if ( eventCount % 2000 === 0 ){
                    //     await new Promise( (resolve) => setTimeout(resolve, 100));
                    // }
                    // document.getElementById(this.containerID)!.innerHTML = output;
                }
            }

            (svg.node()! as HTMLElement).appendChild( extentContainer );
        }
    
        // const DEBUG_renderedRanges = this.renderedRanges.filter( (range) => range.rendered );
        // console.log("Actually rendered ranges at this point: ", DEBUG_renderedRanges.length, DEBUG_renderedRanges);
    }

}


