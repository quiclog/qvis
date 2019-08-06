import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@quictools/qlog-schema';

export default class SequenceDiagramD3Renderer {

    public containerID:string;
    public svgID:string;
    public rendering:boolean = false;

    constructor(containerID:string, svgID:string){
        this.containerID = containerID;
        this.svgID = svgID;
    }
   
    public render(traces:Array<QlogConnection>) {
        if ( this.rendering ) {
            return;
        }

        this.rendering = true;

        this.renderTimeSliced(traces).then( () => {
            this.rendering = false;
        });
    }

    protected ensureMoreThanOneTrace(traces:Array<QlogConnection>) {

        if ( traces.length > 1 ){
            return;
        }

        if ( traces[0].parent.getConnections().length > 1 ){
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

    protected calculateCoordinates(traces:Array<QlogConnection>){

        // we perform a naive online k-way merge to process the events in their timestamp order
        // https://en.wikipedia.org/wiki/K-way_merge_algorithm
        const heads:Array<number> = new Array<number>( traces.length ).fill(0); // points to the current index of each trace we're looking at
        let doneCount = 0;

        console.log( "CalculateCoordinates start" );

        let done = false;
        while ( !done ) {
            let currentMinimumTrace:number = -1;
            let currentMinimumValue:number = Number.MAX_VALUE;
            let currentMinimumEvent:any = undefined;

            for ( let t = 0; t < traces.length; ++t ){
                if ( heads[t] === -1 ) { // means that array has been processed completely
                    continue;
                }

                const evt = traces[t].getEvents()[ heads[t] ];
                const time = traces[t].parseEvent(evt).time;
                
                if( time < currentMinimumValue ){
                    currentMinimumTrace = t;
                    currentMinimumValue = time;
                    currentMinimumEvent = evt;
                }
            }

            // TODO: calculate coordinate for the current minimum
            // TODO: what happens with identical timestamps? should favor single trace, right?
            this.createPrivateNamespace(currentMinimumEvent);
            (currentMinimumEvent as any).qvis.sequencediagram.time = traces[currentMinimumTrace].parseEvent(currentMinimumEvent).time;

            console.log("Next event was : ", (currentMinimumEvent as any).qvis.sequencediagram.time, currentMinimumTrace, currentMinimumValue);

            heads[ currentMinimumTrace ] += 1;
            if ( heads[currentMinimumTrace] >= traces[currentMinimumTrace].getEvents().length ) {
                heads[ currentMinimumTrace ] = -1;
                ++doneCount;
            }

            done = doneCount === traces.length;
        }

        // for ( const trace of traces ){
        //     for ( const event of trace.getEvents() ){
        //         this.createPrivateNamespace(event);

        //         (event as any).qvis.sequencediagram.time = trace.parseEvent(event).time;
        //     }
        // }
    }

    protected async renderTimeSliced(tracesOriginal:Array<QlogConnection>){

        const container:HTMLElement = document.getElementById(this.containerID)!;

        if ( container === undefined ){
            console.error("SequenceDiagramD3Renderer:renderTimeSliced : container element not found, cannot render!", this.containerID);

            return;
        }

        // TODO: verify traces are left-to-right : i.e., arrows do not go UP!
        // 

        const traces = tracesOriginal.slice(); // shallow copy since we might want to add a trace 
        this.ensureMoreThanOneTrace( traces );

        console.log("SequenceDiagramD3Renderer:renderTimeSliced : rendering traces", traces);

        this.calculateCoordinates( traces );

        // About rendering performance:
        // - simply using d3 directly and creating all the svg shapes in 1 big loop is very slow for large files (>10s)
        //      - main bottlenecks are Major GCs (apparently .appendChild and .createElement creates tons of garbage...) but also "recalculate style" and "layout"
        //      - adding elements to an svg element that is already in the DOM tree is slower than adding them to a sepate svg element (via d3.create) but not much
        //      - adding elements in a time-sliced way (e.g., pause 100ms after every 2000 events) works, but we still see very high reflow/layout costs (>200ms per batch)
        //      - using documentFragment does nothing (very similar to adding to an SVG that's not in the DOM tree yet)
        // - doing svg elements without d3: is somewhat faster (say 8s -> 6s) and seems to induce less garbage collection: recommended
        // - doing canvas : just 1s to draw and render everything... there's really no competition

        const containerWidth:number = container.clientWidth;

        // using an on-screen svg element to put our new objects in is -way- slower 
        // than using one that hasn't been added to the DOM yet before filling it
        const svgOrig = d3.select("body").select( "#" + this.svgID );
        // svgOrig.selectAll("*").remove();
        svgOrig.remove();
        // const svg = svgOrig;

        
        const svg = d3.create("svg").attr("id", this.svgID);
        svg.attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
            .attr("font-family", "Trebuchet MS");

        svg.attr("width", containerWidth);
        svg.attr("height", 10000);
        svg.attr("viewbox", `0 0 ${containerWidth} ${10000}`);
        // svg.style("position: absolute;");

        const bandWidth = (containerWidth / traces.length);
        const pixelsPerMillisecond = 1;
        let containerHeight:number = 0;


        let output = '';

        for ( let i = 0; i < traces.length; ++i ){
            const trace = traces[i];
            const currentX =  bandWidth * i + (bandWidth * 0.5);

            const events = trace.getEvents();
            let eventCount = 0;
            let currentY = 0;
            for ( const evt of events ){
                // const parsedEvent = trace.parseEvent(evt);
                // output += "D3 baby " + parsedEvent.time + " : " + parsedEvent.category + " : " + parsedEvent.name + " <br/>";

                currentY = (evt as any).qvis.sequencediagram.time * pixelsPerMillisecond;

                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute('x', "" + currentX);
                rect.setAttribute('y', "" + currentY);
                rect.setAttribute('width', "10");
                rect.setAttribute('height', "2");
                rect.setAttribute('fill', 'green');
                svg.node()!.appendChild( rect );


                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute('x', "" + currentX + 10);
                text.setAttribute('y', "" + currentY);
                text.textContent = "" + currentY;
                svg.node()!.appendChild( text );

                // svg.append('rect').attr('x', currentX).attr('y', currentY).attr('width', 10).attr('height', 2).attr('fill', 'green');
                // svg.append('text').attr('x', currentX + 10).attr('y', currentY).text( currentY );

                containerHeight = Math.max(containerHeight, currentY + 10);
                ++eventCount;

                // if ( eventCount % 2000 === 0 ){
                //     await new Promise( (resolve) => setTimeout(resolve, 100));
                // }
                // document.getElementById(this.containerID)!.innerHTML = output;
            }
        }

        // TODO: remove, just for show
        svg.append('rect').attr('x', 50).attr('y', 50).attr('width', 200).attr('height', 100).attr('fill', 'green');
    
        // draw the vertical timelines 
        // we do this last, since only now we know the total height of the SVG 
        for ( let i = 0; i < traces.length; ++i ){
            const currentX =  bandWidth * i + (bandWidth * 0.5);

            svg.append('rect').attr("x", currentX).attr("y", 0).attr("width", 2).attr("height", containerHeight).attr("fill", "black");

        }


        svg.attr("height", containerHeight);
        svg.attr("viewbox", `0 0 ${containerWidth} ${containerHeight}`);

        // this works, but for some reason the d3 types don't recognize it...
        (d3.select("#" + this.containerID).node() as any).appendChild( svg.node() );

        container.insertAdjacentHTML('beforeend', output);
    }

}


