import QlogConnection from "@/data/Connection"

// This is basically the wrapper for a single qlog file, which contains multiple traces ("connections")
export default class QlogConnectionGroup {
    
    public filename:string;
    public title:string;
    public description:string;

    public summary:any;

    private connections:Array<QlogConnection>;

    public constructor() {
        this.connections = new Array<QlogConnection>();
        this.filename = "";
        this.title = "";
        this.description = "";
        this.summary = {};
    }

    public addConnection( connection:QlogConnection ):void { this.connections.push( connection ); }
    public getConnections() { return this.connections; }
}
