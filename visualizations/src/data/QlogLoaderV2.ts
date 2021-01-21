import QlogConnectionGroup from '@/data/ConnectionGroup';

import * as qlog02 from '@/data/QlogSchema02';
import QlogConnection from '@/data/Connection';
import { IQlogEventParser, IQlogRawEvent, TimeTrackingMethod } from '@/data/QlogEventParser';
import { EventFieldsParser } from './QlogLoader';

// V2 because we wanted a cleaner separation for draft02 from all the "old style" stuff in the QlogLoader class
// eventually, this needs to be refactored so that the V2 class is the main, and then have a QlogLoaderLegacy or something for the rest
export class QlogLoaderV2 {

    public static fromJSON(json:any) : QlogConnectionGroup | undefined {

        if ( json && json.qlog_version ){ 
            const version = json.qlog_version;

            if ( qlog02.Defaults.versionAliases.indexOf(version) >= 0 ){
                return QlogLoaderV2.fromDraft02(json);
            }
            else {
                console.error("QlogLoaderV2: Unknown qlog version! Only " + qlog02.Defaults.versionAliases + " are supported!", version, json);
                
                return undefined;
            }
        }
        else {
            console.error("QlogLoaderV2: qlog files MUST have a qlog_version field in their top-level object!", json);

            return undefined;
        }
    }

    protected static fromDraft02(json:any) : QlogConnectionGroup {

        const fileContents:qlog02.IQLog = json as qlog02.IQLog;

        console.log("QlogLoaderV2:fromDraft02 : ", fileContents, fileContents.traces);

        const group = new QlogConnectionGroup();
        group.version = fileContents.qlog_version;
        group.format = fileContents.qlog_format ? "" + fileContents.qlog_format : qlog02.LogFormat.JSON;
        group.title = fileContents.title || "";
        group.description = fileContents.description || "";

        for ( let jsonconnection of fileContents.traces ){

            const qlogconnections:Array<QlogConnection> = new Array<QlogConnection>();

            if ( (jsonconnection as qlog02.ITraceError).error_description !== undefined ) {
                jsonconnection = jsonconnection as qlog02.ITraceError;

                const conn = new QlogConnection(group);
                conn.title = "ERROR";
                conn.description = jsonconnection.uri + " : " + jsonconnection.error_description;
                continue;
            }

            jsonconnection = jsonconnection as qlog02.ITrace;

            // from draft-02 onward, we allow both event_fields (csv-alike setup) and "normal" JSON formats in qvis, 
            // even thoug hthe csv-alike setup has been removed from the draft
            let usesEventFields:boolean = false;

            if ( (jsonconnection as any).event_fields !== undefined && (jsonconnection as any).event_fields.length > 0  ) {
                usesEventFields = true;
            }

            // a single trace can contain multiple component "traces" if group_id is used and we need to split them out first
            let needsSplit:boolean = false;

            let groupIDKey:string|number = "group_id";

            if ( usesEventFields ){
                groupIDKey = (jsonconnection as any).event_fields.indexOf("group_id");

                if ( groupIDKey >= 0 ) { 
                    needsSplit = true;
                }
            }
            else {
                // if needs split, ALL event need a group_id in this mode
                if ( jsonconnection.events && jsonconnection.events.length > 0 && jsonconnection.events[0][groupIDKey as any] !== undefined ) {
                    needsSplit = true;
                }
            }

            if ( needsSplit ){

                const groupLUT:Map<string, QlogConnection> = new Map<string, QlogConnection>();

                for ( const event of jsonconnection.events ) {

                    // allow an empy last element to get around trailing comma restrictions in JSON
                    if ( event.length === 0 || Object.keys(event).length === 0 ) {
                        continue;
                    }

                    let groupID = event[ groupIDKey as any ]; // lookup in JS works both if string or number, magic!

                    if ( typeof groupID !== "string" ) {
                        groupID = JSON.stringify(groupID);
                    }

                    let conn = groupLUT.get(groupID as string);

                    if ( !conn ){
                        conn = new QlogConnection(group);
                        conn.title = "Group " + groupID + " : ";
                        groupLUT.set( groupID as string, conn );

                        qlogconnections.push( conn );
                    }

                    conn.getEvents().push( event as any ); // TODO: remove case once QlogConnection is properly updated!
                }
            }
            // just one component trace, easy mode
            else {
                const conn = new QlogConnection(group);
                qlogconnections.push( conn );
                conn.setEvents( jsonconnection.events as any );

                // allow an empy last element to get around trailing comma restrictions in JSON
                const lastEvent = jsonconnection.events[ jsonconnection.events.length - 1 ];
                if ( lastEvent.length === 0 || Object.keys(lastEvent).length === 0 ) {
                    conn.getEvents().splice( jsonconnection.events.length - 1, 1 );
                }
            }



            // component traces share most properties of the overlapping parent trace (e.g., vantage point etc.)
            for ( const connection of qlogconnections ){

                connection.title += jsonconnection.title ? jsonconnection.title : "";
                connection.description += jsonconnection.description ? jsonconnection.description : "";
                
                connection.vantagePoint = jsonconnection.vantage_point || {} as qlog02.IVantagePoint;

                if ( !connection.vantagePoint.type ){
                    connection.vantagePoint.type = qlog02.VantagePointType.unknown;
                    connection.vantagePoint.flow = qlog02.VantagePointType.unknown;
                    connection.vantagePoint.name = "No VantagePoint set";
                }

                connection.commonFields = jsonconnection.common_fields!;
                connection.configuration = jsonconnection.configuration || {};

                if ( usesEventFields ) {
                    connection.eventFieldNames = (jsonconnection as any).event_fields;
                    connection.setEventParser( new EventFieldsParser() );
                }
                else {
                    connection.setEventParser( new DirectEventParser() );
                }

                // TODO: remove! Slows down normal traces!
                let misOrdered = false;
                let minimumTime = -1;
                for ( const evt of connection.getEvents() ){
                    const parsedEvt = connection.parseEvent(evt);
                    
                    if ( parsedEvt.absoluteTime >= minimumTime ){
                        minimumTime = parsedEvt.absoluteTime;
                    }
                    else {
                        misOrdered = true;
                        console.error("QlogLoaderV2:draft02 : timestamps were not in the correct order!", parsedEvt.absoluteTime, " < ", minimumTime, parsedEvt);
                        break;
                    }
                }

                if ( misOrdered ){
                    connection.getEvents().sort( (a, b) => { return connection.parseEvent(a).absoluteTime - connection.parseEvent(b).absoluteTime });
                    console.error("QlogLoaderV2:draft02 : manually sorted trace on timestamps!", connection.getEvents());

                    // because startTime etc. could have changes because of the re-ordering
                    if ( connection.eventFieldNames !== undefined && connection.eventFieldNames.length > 0 ) {
                        connection.setEventParser( new EventFieldsParser() );
                    }
                    else {
                        connection.setEventParser( new DirectEventParser() );
                    }

                    alert("Loaded trace was not absolutely ordered on event timestamps. We performed a sort() in qvis, but this slows things down and isn't guaranteed to be stable if the timestamps aren't unique! The qlog spec requires absolutely ordered timestamps. See the console for more details.");
                }

                // TODO: remove eventually. Mainly sanity checks to make sure draft-02 is properly followed, since there were breaking changes between -01 and -02
                const O2errors = [];
                let incorrectSize = false;
                let incorrectpayloadlength = false;
                let incorrectType = false;
                for ( const evt of connection.getEvents() ){
                    const parsedEvt = connection.parseEvent(evt);
                    
                    const data = parsedEvt.data;

                    if ( data && data.header ) {
                        if ( data.header.packet_size ) {
                            if ( !incorrectSize ) {
                                O2errors.push( "events had data.header.packet_size set, use data.raw.length instead (example: " + parsedEvt.category + ":" + parsedEvt.name + ")" );
                                incorrectSize = true;
                            }

                            if ( !data.raw ) {
                                data.raw = {};
                            }

                            data.raw.length = data.header.packet_size;
                            delete data.header.packet_size;
                        }

                        if ( data.header.payload_length ) {
                            if ( !incorrectpayloadlength ) {
                                O2errors.push( "events had data.header.payload_length set, use data.raw.payload_length instead (example: " + parsedEvt.category + ":" + parsedEvt.name + ")");
                                incorrectpayloadlength = true;
                            }

                            if ( !data.raw ) {
                                data.raw = {};
                            }

                            data.raw.payload_length = data.header.payload_length;
                            delete data.header.payload_length;
                        }
                    }

                    if ( data && data.packet_type ) {
                        if ( !incorrectType ) {
                            O2errors.push( "events had data.packet_type set: use data.header.packet_type instead (example: " + parsedEvt.category + ":" + parsedEvt.name + ")");
                            incorrectType = true;
                        }

                        if ( !data.header ) {
                            data.header = {};
                        }

                        data.header.packet_type = data.packet_type;
                        delete data.packet_type;
                    }
                }

                if ( usesEventFields ) {
                    O2errors.push( "Trace still uses event_fields. This method is deprecated in draft-02, though qvis still supports it. Better to use the more traditional -02 JSON or NDJSON formats instead.");
                }

                if ( fileContents.qlog_format === undefined || fileContents.qlog_format.length === 0 ) {
                    O2errors.push( "Trace does not specify a qlog_format entry, which is required in draft-02. JSON was assumed.");
                }

                if ( O2errors.length !== 0 ) {
                    console.error("QlogLoaderV2:fromDraft02: ERROR: non-compliant qlog draft-02 trace:");
                    for ( const err of O2errors ) {
                        console.error( err );
                    }

                    alert( " ERROR: non-compliant qlog draft-02 trace! \n\n" + O2errors.join("\n\n") + "\n\nqvis has attempted to auto-fix these things, so thing should mostly still work." );
                }
            }
        }

        return group;
    }
}

// tslint:disable max-classes-per-file
export class DirectEventParser implements IQlogEventParser {

    // in draft-02, we switched from having qlog events as arrays of just values (coupled with "column names" in event_fields)
    // to using normal JSON objects as events
    // so [500, "transport", "packet_sent", { ... } ]
    // became { time: 500, name: "transport:packet_sent", "data": {}}
    // for the old-style, we use the EventFieldsParser class
    // for the new-style, this DirectEventParser is used instead

    private timeTrackingMethod = TimeTrackingMethod.ABSOLUTE_TIME;
    
    private addTime:number = 0;
    private subtractTime:number = 0;
    private timeMultiplier:number = 1;
    private _timeOffset:number = 0;

    private categoryCommon:string = "unknown";
    private nameCommon:string = "unknown";


    private currentEvent:IQlogRawEvent|undefined|any;

    public get relativeTime():number {
        if ( this.currentEvent === undefined || this.currentEvent.time === undefined ) {
            return 0;
        }

        // TODO: now we do this calculation whenever we access the .time property
        // probably faster to do this in a loop for each event in init(), but this doesn't fit well with the streaming use case...
        // can probably do the parseFloat up-front though?
        // return parseFloat((this.currentEvent as IQlogRawEvent)[this.timeIndex]) * this.timeMultiplier - this.subtractTime + this._timeOffset;
        return parseFloat(this.currentEvent!.time) * this.timeMultiplier - this.subtractTime + this._timeOffset;
    }

    public get absoluteTime():number {
        if ( this.currentEvent === undefined || this.currentEvent.time === undefined ) {
            return 0;
        }

        return parseFloat(this.currentEvent!.time) * this.timeMultiplier + this.addTime + this._timeOffset;
    }

    public getAbsoluteStartTime():number {
        // when relative time, this is reference_time, which is stored in this.addTime
        // when absolute time, this is the time of the first event, which is stored in this.subtractTime
        if ( this.timeTrackingMethod === TimeTrackingMethod.RELATIVE_TIME ){
            return this.addTime;
        }
        else if ( this.timeTrackingMethod === TimeTrackingMethod.ABSOLUTE_TIME ){
            return this.subtractTime;
        }
        else {
            console.error("QlogLoader: No proper startTime present in qlog file. This tool doesn't support delta_time yet!");

            return 0;
        }
    }

    public get timeOffset():number {
        return this._timeOffset;
    }

    // we either have .name = "category:name" and need to split
    // OR we just have .category directly
    public get category():string {
        if ( this.currentEvent && this.currentEvent.category ) {
            return this.currentEvent.category;
        }
        else if ( this.currentEvent && this.currentEvent.name ) {
            return this.currentEvent.name.split(":")[0]; // TODO: OPTIMIZE SOMEHOW?!?
        }
        else {
            return this.categoryCommon;
        }
    }

    // this is a bit confusing...
    // in draft-01, we used the term "type" to describe the event type
    // but in qvis, we used the term "name"
    // now, in draft-02, there is actually a "name" field, used to describe the concatenation of category and type (i.e., name = "category:type")
    // so here, we try to deal with that ambiguity, given that qvis expects just the type when asking for event.name, instead of the concatenation
    public get name():string {
        if ( this.currentEvent === undefined || this.currentEvent.name === undefined ) {
            return this.nameCommon;
        }

        // .name SHOULD be "category:name", but it CAN also just be "name" so...
        // ideally, it would be .type, but we've steered away from that out of fear that 'type' would be a reserved keyword in some language
        const  split = this.currentEvent.name.split(":"); // TODO: OPTIMIZE SOMEHOW?!?

        if ( split.length > 1 ) {
            return split[1];
        }
        else {
            return split[0];
        }
    }

    public set name(val:string) {
        if ( this.currentEvent === undefined || this.currentEvent.name === undefined ) {
            return;
        }

        // e.g., "transport:packet_sent" becomed "transport:packet_received" if curName === "packet_sent"
        const curName = this.name;
        this.currentEvent.name = this.currentEvent.name.replace( curName, val );
    }

    public get data():any|undefined {
        if ( this.currentEvent === undefined || this.currentEvent.data === undefined ) {
            return;
        }

        return this.currentEvent.data;
    }

    public timeToMilliseconds(time: number | string): number {
        return parseFloat(time as any) * this.timeMultiplier;
    }

    public getTimeTrackingMethod():TimeTrackingMethod {
        return this.timeTrackingMethod;
    }

    public init( trace:QlogConnection ) {
        this.currentEvent = undefined;

        if ( trace.commonFields ){
            if ( trace.commonFields.category ) {
                this.categoryCommon = trace.commonFields.category;
            }
            if ( trace.commonFields.name ) {
                this.nameCommon = trace.commonFields.name;
            }

            if ( trace.commonFields.time_format ) {
                if ( trace.commonFields.time_format === qlog02.TimeFormat.relative ) {
                    this.timeTrackingMethod = TimeTrackingMethod.RELATIVE_TIME;
                }
                else if ( trace.commonFields.time_format === qlog02.TimeFormat.delta ) {
                    this.timeTrackingMethod = TimeTrackingMethod.DELTA_TIME;
                }
                else {
                    this.timeTrackingMethod = TimeTrackingMethod.ABSOLUTE_TIME;
                }
            }
            else {
                // if choosing relative timestamps, they really SHOULD set time_format
                // though in draft-01 this wasn't required, so cut people some slack
                if ( trace.commonFields.reference_time !== undefined ) {
                    this.timeTrackingMethod = TimeTrackingMethod.RELATIVE_TIME;

                    // tslint:disable-next-line:max-line-length
                    console.warn("QlogLoaderV2:Parse: the trace sets reference_time but doesn't set time_format! This is needed starting in draft-02, please change your qlogs! We pretend here that time_format was set to \"relative\".", trace.commonFields);
                }
                else {
                    this.timeTrackingMethod = TimeTrackingMethod.ABSOLUTE_TIME;
                }
            }
        }

        // events are normal JSON objects, typically having 3 properties: time, name, data

        if ( trace.configuration && trace.configuration.time_units && trace.configuration.time_units === "us" ){
            this.timeMultiplier = 0.001; // timestamps are in microseconds, we want to view everything in milliseconds
        }

        // We have two main time representations: relative or absolute
        // We want to convert between the two to give outside users their choice of both
        // to get ABSOLUTE time:
        // if relative timestamps : need to do reference_time + time
        // if absolute timestamps : need to do 0 + time
        // to get RELATIVE time:
        // if relative: need to return time - 0
        // if absolute: need to return time - events[0].time

        // so: we need two variables: addTime and subtractTime


        if ( this.timeTrackingMethod === TimeTrackingMethod.ABSOLUTE_TIME ){
            this.addTime = 0;
            this.subtractTime = parseFloat( (trace.getEvents()[0] as any)!.time );
        }
        else if ( this.timeTrackingMethod === TimeTrackingMethod.RELATIVE_TIME ) {
            if ( trace.commonFields && trace.commonFields.reference_time !== undefined ){
                this.addTime = this.parseReferenceTime( trace.commonFields.reference_time, this.timeMultiplier );
                this.subtractTime = 0;
            }
            else {
                console.error("QlogLoaderV2: Using time_format === \"relative\" but no reference_time found in common_fields. Assuming 0.", trace.commonFields);
                this.addTime = 0;
                this.subtractTime = 0;
            }
        }
        else if ( this.timeTrackingMethod === TimeTrackingMethod.DELTA_TIME ) {
            // DELTA_TIME is a weird one: timestamps are encoded relatively to the -previous- one
            // since we don't always want to loop over events in-order, we support this using a pre-processing step here
            // we basically construct the ABSOLUTE timestamps for all the events and then pretend we had absolute all along
            // this only works if we have the events set here though...
            this.timeTrackingMethod = TimeTrackingMethod.ABSOLUTE_TIME;

            const allEvents = trace.getEvents()
            if ( !allEvents || allEvents.length === 0 ) {
                console.error("QlogLoaderV2: DELTA_TIME requires all events to be set before setEventParser is called... was not the case here!");
            }
            else {
                // allow both a start time in commonFields.reference_time AND as the first event element
                if ( trace.commonFields && trace.commonFields.reference_time !== undefined ){
                    this.addTime = 0;
                    this.subtractTime = this.parseReferenceTime( trace.commonFields.reference_time, this.timeMultiplier );
                    (allEvents[0] as any).time = parseFloat( (allEvents[0] as any).time ) + this.subtractTime; // so we can start from event 1 below
                    // note: it's not just = this.subtractTime: the ref_time could be set when the process starts and stay the same for many connections that start later 
                    // put differently: first timestamp isn't always 0
                }
                else {
                    this.addTime = 0;
                    this.subtractTime = parseFloat( (allEvents[0] as any).time );
                }
            }

            // transform the timestamps into absolute timestamps starting from the initial time found above
            // e.g., initial time is 1500, then we have 3, 5, 7
            // then the total timestamps should be 1500, 1503, 1508, 1515
            let previousTime = this.subtractTime;
            for ( let i = 1; i < allEvents.length; ++i  ) { // start at 1, because the first event can be special, see above
                // console.log("Starting at ", allEvents[i][ this.timeIndex ], "+", previousTime, " gives ", parseFloat(allEvents[i][ this.timeIndex ]) + previousTime);
                (allEvents[i] as any).time = parseFloat((allEvents[i] as any).time) + previousTime;
                previousTime = (allEvents[i] as any).time;
            }
        }
        else {
            console.error("QlogLoaderV2: No time_format present in qlog file. Pick one of either absolute, relative or delta in common_fields", trace.commonFields);
        }

        if ( trace.configuration && trace.configuration.time_offset ){
            this._timeOffset = parseFloat( trace.configuration.time_offset ) * this.timeMultiplier;
        }

        this.addTime        *= this.timeMultiplier;
        this.subtractTime   *= this.timeMultiplier;
    }

    public setReferenceTime( time_ms:number ) : void {
        this.addTime = time_ms;
        // incoming time MUST BE IN MILLISECONDS for this to work!
        // as such, the next line isn't needed (and was removed because it led to bugs)
        // this.addTime *= this.timeMultiplier;
    }

    public load( evt:IQlogRawEvent ) : IQlogEventParser {
        this.currentEvent = evt;

        return this;
    }

    protected parseReferenceTime(refTimeIn:string, multiplier:number) : number {
        // normally, we expect reference time to be in milliseconds or microseconds since the unix epoch
        // in this case, parseFloat() gives us the value we need and we later adjust it to milliseconds
        // however, we also want to support time strings like "2020-08-16T20:53:56.582164977+00:00"
        // for this, we can use Date.parse and hope things go right.

        if ( typeof refTimeIn === "string" && 
             (  
                refTimeIn.indexOf(":") >= 0 ||
                refTimeIn.indexOf("-") >= 0 
             ) ) {
                // we assume we have a timestring, let's try
                console.warn("QlogLoader:parseReferenceTime: We think reference_time is not in 'milliseconds since epoch' as a number, but rather as a time string. That is not really supported, though we'll try to parse it here!", refTimeIn);
                
                if ( multiplier === 1 ) { // Date.parse is always in ms accuracy
                    return Date.parse( refTimeIn );
                } else {
                    return Date.parse( refTimeIn ) * 1000; // only other option is us, so need to do ms * 1000 to get that (small loss of accuracy here)
                }
        }

        return parseFloat( refTimeIn );
    }
}
