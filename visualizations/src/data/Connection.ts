import QlogConnectionGroup from '@/data/ConnectionGroup';
import { IQlogEventParser, IQlogRawEvent } from '@/data/QlogEventParser';
import * as qlog from '@quictools/qlog-schema';
import Vue from 'vue';

// a single trace
export default class QlogConnection {


    public parent:QlogConnectionGroup;
    public title:string;
    public description:string;

    public eventFieldNames:Array<string> = new Array<string>();
    public commonFields:qlog.ICommonFields = {};
    public configuration:qlog.IConfiguration = { time_offset: "0", time_units: "ms", original_uris: [] };

    public vantagePoint!:qlog.IVantagePoint;

    private events:Array<IQlogRawEvent>;

    // The EventParser is needed because qlog events aren't always of the same shape
    // They are also defined as flat arrays, with their member names defined separately (in event_fields)
    // As such, it is not immediately clear which of the indices in the flat array leads to which property (e.g., the timestamp is -usually- at 0, but could be anywhere)
    // So, the eventParser classes deal with this: figure out dynamically which index means what. We can then lookup the index by doing parser.load(event).propertyName
    private eventParser!:IQlogEventParser;

    public constructor(parent:QlogConnectionGroup) {
        this.parent = parent;
        this.title = "NewConnection";
        this.description = "";
        this.events = new Array<IQlogRawEvent>();

        (this.events as any)._isVue = true;

        this.parent.AddConnection( this );
    }

    public SetEventParser( parser:IQlogEventParser ){
        // we need to bypass Vue's reactivity here
        // this Connection class is made reactive in ConnectionStore, including the this.eventParser property and its internals
        // however, if we use parseEvent(), this will update the internal .currentEvent property of this.eventParser
        // That update reactively triggers an update...
        // SO: if we would do {{ connection.parseEvent(evt).name }} inside the template (which is like... the main use case here)
        // then we get an infinite loop of reactivity (parseEvent() triggers update, update is rendered, template calls parseEvent() again, etc.)

        // Addittionally, we also don't want the full qlog file to be reactive: just the top-level stuff like the iQlog and the traces
        // the individual events SHOULD NOT be reactive:
        // 1) because they probably won't change
        // 2) because they can be huge and it would get very slow with the way Vue does observability (adding an __ob__ Observer class to EACH object and overriding getters/setters for everything)

        // We looked at many ways of doing this, most of which are discussed in the following issue:
        // https://github.com/vuejs/vue/issues/2637
        // In the end, the only thing that really worked for this specific setup is the ._isVue method
        // We use this both for eventParser and events and for the current setup, it seems to prevent both the infinite loop and event objects being marked as Observable
        // Obviously this is an ugly hack, but since Vue doesn't include a way to do this natively, I really don't see a better way...

        (parser as any)._isVue = true; // prevent the parser from being Vue Reactive
        this.eventParser = parser;
        this.eventParser.init( this );
    }

    public parseEvent( evt:IQlogRawEvent ){
        return this.eventParser.load( evt );
    }

    public SetEvents(events:Array<Array<any>>):void { 
        (events as any)._isVue = true; // prevent the individual events from being Vue Reactive, see above
        this.events = events; 
    }
    public GetEvents():Array<Array<any>> { return (this as any).events; }
}
