import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@/data/QlogSchema';


export default class SequenceDiagramCanvasRenderer {

    public containerID:string;
    public rendering:boolean = false;

    constructor(containerID:string){
        this.containerID = containerID;
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

    protected calculateCoordinates(traces:Array<QlogConnection>):number {

        const pixelsPerMillisecond = 2;

        // we have n traces, each with their own timestamped events
        // we want to map these on a single conceptual sequence diagram, so that the same timestamps line up correctly on the y-axis, but still have a single vertical timeline per-trace
        // we also want to cut out long periods of inactivity and prevent overlaps (e.g., for many packets at the same timestamp)
        // To do this, we have to calculate the y-coordinates as we go, accumulting to prevent overlaps, skipping large idle periods and keeping things in-sync between traces
        // the simplest way to do this would be to merge all the traces into 1 big event log, ordered by timestamp
        // However, since the traces can get quite big, we don't want to do this, as it would use -a lot- of memory
        // So instead we perform a naive online k-way merge (so without actually moving to new memory) to process the events in their timestamp order
        // https://en.wikipedia.org/wiki/K-way_merge_algorithm
        const heads:Array<number> = new Array<number>( traces.length ).fill(0); // points to the current index of each trace we're looking at
        let doneCount = 0;

        let DEBUG_totalCount = 0;
        let maxCoordinate = 0;

        console.log( "CalculateCoordinates start" );

        let done = false;
        while ( !done ) {
            let currentMinimumTrace:number = -1;
            let currentMinimumValue:number = Number.MAX_VALUE;
            // tslint:disable-next-line:no-unnecessary-initializer
            let currentMinimumEvent:any = undefined;

            for ( let t = 0; t < traces.length; ++t ){
                if ( heads[t] === -1 ) { // means that array has been processed completely
                    continue;
                }

                const evt = traces[t].getEvents()[ heads[t] ];
                const time = traces[t].parseEvent(evt).relativeTime;
                
                if ( time < currentMinimumValue ){
                    currentMinimumTrace = t;
                    currentMinimumValue = time;
                    currentMinimumEvent = evt;
                }
            }

            // TODO: make sure coordinates for the same timestamp are the same across traces (in the same trace, it should shift down, and also shift other traces down. What do you mean "complex"?)
            // TODO: allow skipping of large periods of inactivity
            this.createPrivateNamespace(currentMinimumEvent);
            (currentMinimumEvent as any).qvis.sequencediagram.y = traces[currentMinimumTrace].parseEvent(currentMinimumEvent).relativeTime * pixelsPerMillisecond; // DEBUG_totalCount * pixelsPerMillisecond;
            ++DEBUG_totalCount;

            maxCoordinate = (currentMinimumEvent as any).qvis.sequencediagram.y;

            heads[ currentMinimumTrace ] += 1;
            if ( heads[currentMinimumTrace] >= traces[currentMinimumTrace].getEvents().length ) {
                heads[ currentMinimumTrace ] = -1;
                ++doneCount;
            }

            done = doneCount === traces.length;
        }

        return maxCoordinate;
    }

    protected async renderTimeSliced(tracesOriginal:Array<QlogConnection>){

        const container:HTMLElement = document.getElementById(this.containerID)!;

        if ( container === undefined ){
            console.error("SequenceDiagramD3Renderer:renderTimeSliced : container element not found, cannot render!", this.containerID);

            return;
        }

        // TODO: verify traces are left-to-right : i.e., arrows do not go UP!

        const traces = tracesOriginal.slice(); // shallow copy since we might want to add a trace 
        this.ensureMoreThanOneTrace( traces );


        const maxY = this.calculateCoordinates( traces );
        console.log("SequenceDiagramD3Renderer:renderTimeSliced : rendering traces", traces, maxY);

        const interactionLayer:HTMLElement = document.createElement("div");
        interactionLayer.setAttribute("id", "sequencediagram-interaction");


        const containerWidth:number = container.clientWidth;
        const containerHeight:number = maxY;

        // Note about performance: canvas is already much faster than SVG, but can still take a while
        // TODO: explore options: rendering to double-buffered canvas first, use multipe on-screen canvases, rendering only parts and updating when scrolling, 
        //       rendering in a web worker thread (potential problems with getting data there), ...

        // To make canvas interactive, there really are no easy shortcuts... 
        // - Tried with Fabric.js : this just crashes the tab with even a moderately sized trace
        // - Tried with overlaying DOM elements : event with visibility off, still invokes a long layout/styling/painting step, taking several seconds
        // - Only option really: keep a custom pixels-to-element dictionary, similar to how chrome's devtools does it:
        //      https://github.com/ChromeDevTools/devtools-frontend/blob/8fb3ac5a4f56332900ddec43aeebb845759531ed/front_end/perf_ui/FlameChart.js#L740

        let canvas:HTMLCanvasElement = document.getElementById("sequencediagram-canvas") as HTMLCanvasElement;
        if ( !canvas ) {
            canvas = document.createElement("canvas");
            canvas.setAttribute("id", "sequencediagram-canvas");
            container.appendChild( canvas );
        }

        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

        // changing width/height of a canvas empties it... so we calculate the maxY first (see above) so we can set it correctly from the start
        // FIXME: TODO: canvases have a maximum size/surface area, need to make sure we don't exceed this
        canvas.setAttribute("width", "" + containerWidth);
        canvas.setAttribute("height", "" + containerHeight);

        container.appendChild( interactionLayer );
        container.setAttribute("style", "position: relative;");
        interactionLayer.setAttribute("style", `position: absolute; left: 0px; top: 0px; width: ${containerWidth}px; height:${containerHeight}px; z-index: 1; border: 2px solid blue;`);
        // interactionLayer.setAttribute("width", "" + containerWidth);
        // interactionLayer.setAttribute("height", "" + containerHeight);

        const bandWidth = (containerWidth / traces.length);
    
        // draw the vertical timelines 
        for ( let i = 0; i < traces.length; ++i ){
            const currentX =  bandWidth * i + (bandWidth * 0.5);

            ctx.fillStyle = 'black';
            ctx.fillRect(currentX, 0, 2, containerHeight);
        }

        // draw the events
        // TODO: if we want to properly time-slice this, we can't draw trace per trace
        //       we would need to e.g., draw 1000 events from trace 1, then 1000 from 2, then back to 1, etc.
        for ( let i = 0; i < traces.length; ++i ){
            const trace = traces[i];
            const currentXline =  bandWidth * i + (bandWidth * 0.5);

            const events = trace.getEvents();
            let currentY = 0;
            for ( const evt of events ){
                currentY = (evt as any).qvis.sequencediagram.y;

                ctx.fillStyle = 'green';
                let currentX = currentXline + (Math.random() * 50);
                ctx.fillRect(currentX, currentY, 10, 10);
                
                ctx.fillStyle = 'black';
                ctx.font = "20px Arial";
                ctx.fillText("" + currentY, currentX + 10, currentY);

                let clicker = document.createElement("div");
                clicker.setAttribute("style", `visibility: hidden; width: 10px; height: 10px; position: absolute; left: ${currentX}px; top: ${currentY}px;`);
                clicker.onclick = (ev) => { alert("Clicked on event!" + (evt as any).qvis.sequencediagram.y); };
                interactionLayer.appendChild(clicker);
            }
        }

        if ( canvas.parentElement === null ) {
            container.appendChild( canvas );
        }

        // fcanvas.renderAll();
    }

}


