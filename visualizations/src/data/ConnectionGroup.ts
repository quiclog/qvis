import Connection from "@/data/Connection"

// This is basically the wrapper for a single qlog file, which can contain multiple connections
export default class ConnectionGroup {
    
    public title:string;
    public description:string;

    private connections:Array<Connection>;

    public constructor() {
        this.connections = new Array<Connection>();
        this.title = "";
        this.description = "";
    }

    public AddConnection( connection:Connection ):void { this.connections.push( connection ); }
    public GetConnections() { return this.connections; }
}
