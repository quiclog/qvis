import QlogEvent from "@/data/Event";
import QlogConnectionGroup from '@/data/ConnectionGroup';

export default class QlogConnection {

    public parent:QlogConnectionGroup;

    private events:Array<QlogEvent>;

    public constructor(parent:QlogConnectionGroup) {
        this.parent = parent;
        this.events = new Array<QlogEvent>();
    }

    public AddEvent(evt:QlogEvent):void { this.events.push(evt); }
    public GetEvents() { return this.events; }
}
