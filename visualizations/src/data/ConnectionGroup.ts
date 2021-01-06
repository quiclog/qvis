import QlogConnection from "@/data/Connection"

// This is basically the wrapper for a single qlog file, which contains multiple traces ("connections")
// NOTE: this has nothing directly to do with the "group_id" concept! 
// TODO: rename this class to QlogCollection or QlogTraceCollection or QlogTraceFile or something
export default class QlogConnectionGroup {
    
    public version:string;
    public format:string;

    public filename:string;
    public title:string;
    public description:string;

    public URL:string;
    public URLshort:string;

    public summary:any;

    private connections:Array<QlogConnection>;

    public constructor() {
        this.connections = new Array<QlogConnection>();
        this.version = "";
        this.format = "JSON";
        this.filename = "";
        this.URL = "";
        this.URLshort = "";
        this.title = "";
        this.description = "";
        this.summary = {};
    }

    public addConnection( connection:QlogConnection ):void { this.connections.push( connection ); }
    public getConnections() { return this.connections; }

    public getShorthand(){
        let output = "";

        if ( this.title ) {
            output += this.title;
        }
        if (this.description) {
            if ( this.description.length <= 50 ) {
                output +=  " : " + this.description;
            }
            else {
                output +=  " : " + this.description.substr(0,50) + "...";
            }
        }

        if ( this.connections.length !== 1 ) {
            output +=  " (" + this.connections.length + " connections)";
        }
        else {
            output +=  " (1 connection)";
        }

        return output;
    }
}
