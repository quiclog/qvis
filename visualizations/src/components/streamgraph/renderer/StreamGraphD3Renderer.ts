import QlogConnection from '@/data/Connection';


export default class StreamGraphD3Renderer {

    public containerID:string;
    // public svgID:string;
    public rendering:boolean = false;

    protected connection!:QlogConnection;

    constructor(containerID:string) {
        this.containerID = containerID;
    }
   
    public async render(connection:QlogConnection):Promise<boolean> {
        if ( this.rendering ) {
            return false;
        }

        console.log("StreamGraphD3Renderer:render", connection);

        this.rendering = true;

        // To make things performant enough, we don't render the full diagram at once
        // We always render just parts of it at the same time
        // this.setup prepares everything, calculates coordinates and relations between events etc.
        // this.renderPartialExtents can then be called on scroll updates. It figures out which part of the SVG is visible and makes sure that part of the diagram is drawn.
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

        return true;
    }

    protected async renderLive() {
        console.log("Rendering streamgraph");

        document.getElementById(this.containerID)!.innerHTML = "<b>It's alive! " + this.connection.title + " : " + this.connection.description + "</b>";

    }

}
