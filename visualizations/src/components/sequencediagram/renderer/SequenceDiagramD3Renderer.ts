import QlogConnection from '@/data/Connection';

export default class SequenceDiagramD3Renderer {

    public containerID:string;
    public rendering:boolean = false;

    constructor(containerID:string){
        this.containerID = containerID;
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

        container.innerHTML = output;
    }

}
