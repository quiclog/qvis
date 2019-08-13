import Connection from "@/data/Connection";

export default class SequenceDiagramConfig {

    public manualRTT:number = -1;
    public scale:number = 0.1; // amount of pixels per ms // by default 1 pixel = 10 ms // can be in [0,1[ to squish things

    // the connections to be shown in the SequenceDiagram
    // index 0 = left, index 1 = next one to the right, ... , length - 1 = rightmost one
    public connections:Array<Connection> = new Array<Connection>();
}
