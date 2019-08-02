import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';

export default class SequenceDiagramD3Renderer {

    public containerID:string;
    public svgID:string;
    public rendering:boolean = false;

    constructor(containerID:string, svgID:string){
        this.containerID = containerID;
        this.svgID = svgID;
    }
   
    public render(traces:Array<QlogConnection>) {
        this.rendering = true;

        this.renderTimeSliced(traces).then( () => {
            this.rendering = false;
        });
    }

    public async renderTimeSliced(traces:Array<QlogConnection>){

        const container:HTMLElement = document.getElementById(this.containerID)!;

        if ( container === undefined ){
            console.error("SequenceDiagramD3Renderer:renderTimeSliced : container element not found, cannot render!", this.containerID);

            return;
        }

        const svg = d3.select("body").select( "#" + this.svgID );
        svg.selectAll("*").remove(); // empty svg 

        const containerWidth:number = container.clientWidth;

        let output = '';

        for ( const trace of traces ){
            for ( const evt of trace.GetEvents() ){
                const parsedEvent = trace.parseEvent(evt);

                output += "D3 baby " + parsedEvent.time + " : " + parsedEvent.category + " : " + parsedEvent.name + " <br/>";

                // document.getElementById(this.containerID)!.innerHTML = output;
                // await new Promise( (resolve) => setTimeout(resolve, 1000));

            }
        }

        // TODO: remove, just for show
        svg.append('rect').attr('x', 50).attr('y', 50).attr('width', 200).attr('height', 100).attr('fill', 'green');
    


        container.insertAdjacentHTML('beforeend', output);
    }

}
