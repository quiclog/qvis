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

        for ( const trace of traces ){
            for ( const event of trace.getEvents() ){
                this.createPrivateNamespace(event);

                (event as any).qvis.sequencediagram.time = trace.parseEvent(event).time;
            }
        }

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


        const containerWidth:number = container.clientWidth;

        const svg = d3.select("body").select( "#" + this.svgID );
        svg.selectAll("*").remove(); // empty svg

        svg.attr("width", containerWidth);

        const bandWidth = (containerWidth / traces.length);
        const pixelsPerMillisecond = 1;
        let containerHeight:number = 0;


        let output = '';

        for ( let i = 0; i < traces.length; ++i ){
            const trace = traces[i];
            const currentX =  bandWidth * i + (bandWidth * 0.5);

            for ( const evt of trace.getEvents() ){
                const parsedEvent = trace.parseEvent(evt);

                output += "D3 baby " + parsedEvent.time + " : " + parsedEvent.category + " : " + parsedEvent.name + " <br/>";

                // document.getElementById(this.containerID)!.innerHTML = output;
                // await new Promise( (resolve) => setTimeout(resolve, 1000));

                const currentY = (evt as any).qvis.sequencediagram.time * pixelsPerMillisecond;

                svg.append('rect').attr('x', currentX).attr('y', currentY).attr('width', 10).attr('height', 2).attr('fill', 'green');

                containerHeight = Math.max(containerHeight, currentY + 10);

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

        container.insertAdjacentHTML('beforeend', output);
    }

}
