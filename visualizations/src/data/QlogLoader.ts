import QlogConnectionGroup from '@/data/ConnectionGroup';


import * as qlog01 from '@quictools/qlog-schema';
import * as qlogPreSpec from '@quictools/qlog-schema/draft-16/QLog';
import { QUtil } from '@quictools/qlog-schema/util';
import QlogConnection from '@/data/Connection';
import { IQlogEventParser, IQlogRawEvent } from '@/data/QlogEventParser';


export class QlogLoader {

    public static fromJSON(json:any) : QlogConnectionGroup | undefined {

        if ( json && json.qlog_version ){
            const version = json.qlog_version;
            if ( version === "0.1" ){
                return QlogLoader.fromPreSpec(json);
            }
            else if ( version === "draft-00" ){
                return QlogLoader.fromDraft00(json);
            }
            else if ( version === "draft-01" ){
                return QlogLoader.fromDraft01(json);
            }
            else {
                alert("QlogLoader: Unknown qlog version! Only draft-00 and draft-01 are supported! You provided: " + version);

                return undefined;
            }
        }
        else {
            alert("QlogLoader: qlog files MUST have a qlog_version field in their top-level object!");

            return undefined;
        }

    }

    protected static fromDraft01(json:any) : QlogConnectionGroup {

        const fileContents:qlog01.IQLog = json as qlog01.IQLog;

        console.log("QlogLoader:fromDraft01 : ", fileContents, fileContents.traces);

        const group = new QlogConnectionGroup();
        group.title = fileContents.title || "";
        group.description = fileContents.description || "";

        for ( let jsonconnection of fileContents.traces ){

            const connection = new QlogConnection(group);

            if ( (jsonconnection as qlog01.ITraceError).error_description !== undefined ) {
                jsonconnection = jsonconnection as qlog01.ITraceError;

                connection.title = "ERROR";
                connection.description = jsonconnection.uri + " : " + jsonconnection.error_description;
            }
            else {
                jsonconnection = jsonconnection as qlog01.ITrace;

                connection.title = jsonconnection.title!;
                connection.description = jsonconnection.description!;
                connection.vantagePoint = jsonconnection.vantage_point!;

                connection.eventFieldNames = jsonconnection.event_fields;
                connection.commonFields = jsonconnection.common_fields!;
                connection.configuration = jsonconnection.configuration!;

                connection.setEvents( jsonconnection.events );

                connection.setEventParser( new EventFieldsParser() );
            }
        }

        return group;
    }

    protected static fromDraft00(json:any) : QlogConnectionGroup {

        const fileContents:any = json; // we don't have TypeScript schema definitions for qlog00

        console.log("QlogLoader:fromDraft00 : ", fileContents, fileContents.traces);

        const group = new QlogConnectionGroup();
        group.title = fileContents.title || "";
        group.description = fileContents.description || "";

        for ( const jsonconnection of fileContents.traces ){

            const connection = new QlogConnection(group);

            connection.title = jsonconnection.title;
            connection.description = jsonconnection.description;

            if ( jsonconnection.vantage_point ){
                connection.vantagePoint = {} as qlog01.IVantagePoint;
                if ( jsonconnection.vantage_point.type === "SERVER" ){
                    connection.vantagePoint.type = qlog01.VantagePointType.server;
                }
                else if ( jsonconnection.vantage_point.type === "CLIENT" ){
                    connection.vantagePoint.type = qlog01.VantagePointType.client;
                }
                else if ( jsonconnection.vantage_point.type === "NETWORK" ){
                    connection.vantagePoint.type = qlog01.VantagePointType.network;
                    connection.vantagePoint.flow = qlog01.VantagePointType.client;
                }
            }

            connection.eventFieldNames = jsonconnection.event_fields;
            connection.commonFields = jsonconnection.common_fields;
            connection.configuration = jsonconnection.configuration;
            connection.setEvents( jsonconnection.events as any );

            connection.setEventParser( new EventFieldsParser() );

            for ( const evt of connection.getEvents() ){
                const data = connection.parseEvent(evt).data;
                if ( data.frames ) {
                    for ( const frame of data.frames ){
                        if ( frame.frame_type ){
                            frame.frame_type = frame.frame_type.toLowerCase();
                        }
                    }
                }
            }
        }

        return group;
    }

    protected static fromPreSpec(json:any) : QlogConnectionGroup {

        const fileContents:qlogPreSpec.IQLog = json as qlogPreSpec.IQLog;

        console.log("QlogLoader:fromPreSpec : ", fileContents, fileContents.connections);

        // QLog00 toplevel structure contains a list of connections
        // most files currently just contain a single connection, but the idea is to allow bundling connections on a single file
        // for example 1 log for the server and 1 for the client and 1 for the network, all contained in 1 file
        // This is why we call it a ConnectionGroup here, instead of QlogFile or something
        const group = new QlogConnectionGroup();
        group.description = fileContents.description || "";

        for ( const jsonconnection of fileContents.connections ){

            const connection = new QlogConnection(group);

            // metadata can be just a string, so use that
            // OR it can be a full object, in which case we want just the description here
            let description = "no description";
            if ( jsonconnection.metadata ){
                if ( typeof jsonconnection.metadata === "string" ){
                    description = jsonconnection.metadata;
                }
                else if ( jsonconnection.metadata.description ){ // can be empty object {}
                    description = jsonconnection.metadata.description;
                }
            }

            if ( jsonconnection.vantagepoint ){
                connection.vantagePoint = {} as qlog01.IVantagePoint;
                if ( jsonconnection.vantagepoint === "SERVER" ){
                    connection.vantagePoint.type = qlog01.VantagePointType.server;
                }
                else if ( jsonconnection.vantagepoint === "CLIENT" ){
                    connection.vantagePoint.type = qlog01.VantagePointType.client;
                }
                else if ( jsonconnection.vantagepoint === "NETWORK" ){
                    connection.vantagePoint.type = qlog01.VantagePointType.network;
                    connection.vantagePoint.flow = qlog01.VantagePointType.client;
                }
            }

            connection.title = description;
            connection.description = description;

            connection.eventFieldNames = jsonconnection.fields;
            connection.setEvents( jsonconnection.events as any );

            connection.setEventParser( new PreSpecEventParser() );
        }

        return group;
    }
}

enum TimeTrackingMethod {
    RAW,
    REFERENCE_TIME,
    DELTA_TIME,
}


// tslint:disable max-classes-per-file
export class EventFieldsParser implements IQlogEventParser {

    private timeTrackingMethod = TimeTrackingMethod.RAW;
    private startTime:number = 0;
    private subtractTime:number = 0;
    private timeMultiplier:number = 1;
    private timeOffset:number = 0;

    private timeIndex:number = 0;
    private categoryIndex:number = 1;
    private nameIndex:number = 2;
    private triggerIndex:number = 3;
    private dataIndex:number = 4;

    private currentEvent:IQlogRawEvent|undefined;

    public get time():number {
        if ( this.timeIndex === -1 ) {
            return 0;
        }

        // TODO: now we do this calculation whenever we access the .time property
        // probably faster to do this in a loop for each event in init(), but this doesn't fit well with the streaming use case...
        // can probably do the parseFloat up-front though?
        return parseFloat((this.currentEvent as IQlogRawEvent)[this.timeIndex]) * this.timeMultiplier - this.subtractTime + this.timeOffset;
    }
    public get category():string {
        if ( this.categoryIndex === -1 ) {
            return "unknown";
        }

        return (this.currentEvent as IQlogRawEvent)[this.categoryIndex].toLowerCase();
    }
    public get name():string {
        if ( this.nameIndex === -1 ) {
            return "unknown";
        }

        return (this.currentEvent as IQlogRawEvent)[this.nameIndex].toLowerCase();
    }
    public set name(val:string) {
        if ( this.nameIndex === -1 ) {
            return;
        }

        (this.currentEvent as IQlogRawEvent)[this.nameIndex] = val;
    }
    public get trigger():string {
        if ( this.triggerIndex === -1 ) {
            return "unknown";
        }

        return (this.currentEvent as IQlogRawEvent)[this.triggerIndex].toLowerCase();
    }
    public get data():any|undefined {
        if ( this.dataIndex === -1 ) {
            return {};
        }

        return (this.currentEvent as IQlogRawEvent)[this.dataIndex];
    }

    public timeToMilliseconds(time: number | string): number {
        return parseFloat(time as any) * this.timeMultiplier;
    }

    public init( trace:QlogConnection ) {
        this.currentEvent = undefined;

        // events are a flat array of values
        // the "column names" are in a separate list: eventFieldNames
        // to know which index of the flat array maps to which type of value, we need to match indices to field types first
        let eventFieldNames = trace.eventFieldNames.slice(); // copy because to tolowercase
        eventFieldNames = eventFieldNames.map( (val) => val.toLowerCase() ); // 00 is uppercase, 01 lowercase

        this.categoryIndex  = eventFieldNames.indexOf( "category" ); // FIXME: get this string from the qlog definitions somewhere
        this.nameIndex      = eventFieldNames.indexOf( "event_type" );
        if ( this.nameIndex === -1 ) {
            this.nameIndex      = eventFieldNames.indexOf( "event" ); // 00 is event_type, 01 is event
        }
        this.triggerIndex   = eventFieldNames.indexOf( "trigger" );
        this.dataIndex      = eventFieldNames.indexOf( "data" );



        this.timeIndex = eventFieldNames.indexOf("time"); // typically 0
        if ( this.timeIndex === -1 ){
            this.timeIndex = eventFieldNames.indexOf("relative_time"); // typically 0

            if ( this.timeIndex === -1 ){
                this.timeTrackingMethod = TimeTrackingMethod.DELTA_TIME;

                alert("QlogLoader: No proper timestamp present in qlog file. This tool doesn't support delta_time yet!");
                console.log("QlogLoader: No proper timestamp present in qlog file. This tool doesn't support delta_time yet!", trace.eventFieldNames);
            }
            else {
                this.timeTrackingMethod = TimeTrackingMethod.REFERENCE_TIME;

                if ( trace.commonFields && trace.commonFields.reference_time !== undefined ){
                    this.startTime = parseFloat(trace.commonFields.reference_time);
                }
                else {
                    alert("QlogLoader: Using relative_time but no reference_time found in common_fields");
                    console.log("QlogLoader: Using relative_time but no reference_time found in common_fields", trace.eventFieldNames, trace.commonFields);
                    this.startTime = 0;
                }
            }
        }
        else{
            this.timeTrackingMethod = TimeTrackingMethod.RAW;
            this.startTime = parseFloat( trace.getEvents()[0][this.timeIndex] );
            this.subtractTime = this.startTime;
        }

        if ( trace.configuration && trace.configuration.time_units && trace.configuration.time_units === "us" ){
            this.timeMultiplier = 0.001; // timestamps are in microseconds, we want to view everything in milliseconds
        }

        if ( trace.configuration && trace.configuration.time_offset ){
            this.timeOffset = parseFloat( trace.configuration.time_offset ) * this.timeMultiplier;
        }

        this.startTime *= this.timeMultiplier;
    }

    public load( evt:IQlogRawEvent ) : IQlogEventParser {
        this.currentEvent = evt;

        return this;
    }
}

// tslint:disable max-classes-per-file
export class PreSpecEventParser implements IQlogEventParser {

    private currentEvent:IQlogRawEvent|undefined;

    public get time():number {
        return parseFloat( (this.currentEvent as IQlogRawEvent)[0] );
    }
    public get category():string {
        return (this.currentEvent as IQlogRawEvent)[1];
    }
    public get name():string {
        return (this.currentEvent as IQlogRawEvent)[2];
    }
    public set name(val:string) {
        (this.currentEvent as IQlogRawEvent)[2] = val;
    }
    public get trigger():string {
        return (this.currentEvent as IQlogRawEvent)[3];
    }
    public get data():any|undefined {
        return (this.currentEvent as IQlogRawEvent)[4];
    }

    public init( trace:QlogConnection ) {
        this.currentEvent = undefined;
    }

    public timeToMilliseconds(time: number | string): number {
        return parseFloat(time as any);
    }

    public load( evt:IQlogRawEvent ) : IQlogEventParser {
        this.currentEvent = evt;

        return this;
    }
}
