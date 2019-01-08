import QlogEvent from "@/data/Event";
import QlogConnectionGroup from '@/data/ConnectionGroup';

export default class QlogConnection {

    public parent:QlogConnectionGroup;
    public name:string; // TODO: this should be  QlogConnection.vantagepoint + " : " + QlogConnection.name

    private events:Array<QlogEvent>;

    public constructor(parent:QlogConnectionGroup) {
        this.parent = parent;
        this.name = "NewConnection";
        this.events = new Array<QlogEvent>();
    }

    public AddEvent(evt:QlogEvent):void { this.events.push(evt); }
    public GetEvents() { return this.events; }
}
