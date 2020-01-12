import Connection from "@/data/Connection";

export default class MultiplexingGraphConfig {

    public collapsed:boolean = true;
    public showwaterfall:boolean = true;
    public showbyteranges:boolean = false;
    public connections:Array<Connection> = new Array<Connection>();
}
