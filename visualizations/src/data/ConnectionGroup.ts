import QlogConnection from "@/data/Connection"

// This is basically the wrapper for a single qlog file, which can contain multiple connections
export default class QlogConnectionGroup {
    
    public title:string;
    public description:string;

    private connections:Array<QlogConnection>;

    public constructor() {
        this.connections = new Array<QlogConnection>();
        this.title = "";
        this.description = "";
    }

    public AddConnection( connection:QlogConnection ):void { this.connections.push( connection ); }
    public GetConnections() { return this.connections; }
}
