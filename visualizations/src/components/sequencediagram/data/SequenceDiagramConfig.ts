import Connection from "@/data/Connection";

// we keep track of the timeOffset separately here for two reasons:
// 1. changing it directly in EventParser wouldn't be reactive by itself, we would have to trigger UI updates another way
// 2. we don't want the global timeOffset to change for all visualizations (e.g., you probably don't want this for the congestion graph)
// Separate tracking allows reactivity, but adds other complexities (e.g., more difficult to persist the offset when changing views etc.)
// Main issue: the timeOffset is forgotten when switching connections in SequenceDiagramConfigurator, since that works on the raw Connection via ConnectionConfigurator...
// as such, we now keep a copy of the timeOffset and some -dirty dirty dirty- persistence code in SequenceDiagramD3Renderer to circumvent this
// TODO: revisit this whole setup to see if something simpler isn't possible
export interface SequenceDiagramConnection {
    connection:Connection,
    timeOffset:number
}

export default class SequenceDiagramConfig {

    public static createConnectionWithTimeoffset(connection:Connection):SequenceDiagramConnection {
        return {
            connection: connection,
            timeOffset: connection.getEventParser() ? connection.getEventParser().timeOffset : 0,
        }
    }

    // public scale:number = 0.1; // amount of pixels per ms // by default 1 pixel = 10 ms // can be in [0,1[ to squish things

    // the connections to be shown in the SequenceDiagram
    // index 0 = left, index 1 = next one to the right, ... , length - 1 = rightmost one
    public connections:Array<SequenceDiagramConnection> = new Array<SequenceDiagramConnection>();

    public timeResolution:number = 1; // for dealing with traces with sub-millisecond latencies (as the sequence diagram groups per millisecond)
}
