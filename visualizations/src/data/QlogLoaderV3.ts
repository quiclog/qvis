import QlogConnectionGroup from '@/data/ConnectionGroup';

import * as qlog03 from '@/data/QlogSchema03';
import QlogConnection from '@/data/Connection';
import { IQlogEventParser, IQlogRawEvent, TimeTrackingMethod } from '@/data/QlogEventParser';

// QlogLoaderV3 reads the "current" IETF qlog drafts (main-schema-14 /
// quic-events-13 / h3-events-13), as opposed to QlogLoaderV2 (draft-02/0.3)
// and QlogLoader (draft-00/01). See QlogSchema03.ts for the structural
// differences and for EventNameMapping, the category/name compatibility
// shim this loader relies on.
export class QlogLoaderV3 {

    public static fromJSON(json:any) : QlogConnectionGroup | undefined {

        if ( json && json.file_schema ) {
            const schema = json.file_schema;

            if ( qlog03.Defaults.fileSchemaAliases.indexOf(schema) >= 0 ){
                return QlogLoaderV3.fromQlogFile(json);
            }
            else {
                console.error("QlogLoaderV3: Unknown file_schema! Only " + qlog03.Defaults.fileSchemaAliases + " are supported!", schema, json);

                return undefined;
            }
        }
        else {
            console.error("QlogLoaderV3: files for this qlog version MUST have a file_schema field in their top-level object!", json);

            return undefined;
        }
    }

    protected static fromQlogFile(json:any) : QlogConnectionGroup {

        const fileContents:qlog03.IQlogFile = json as qlog03.IQlogFile;

        console.log("QlogLoaderV3:fromQlogFile : ", fileContents, fileContents.traces || fileContents.trace);

        const group = new QlogConnectionGroup();
        group.version = qlog03.Defaults.versionName;
        group.format = fileContents.serialization_format || "application/qlog+json";
        group.title = fileContents.title || "";
        group.description = fileContents.description || "";

        let traces = fileContents.traces;

        if ( !traces && fileContents.trace ) {
            // QlogFileSeq ("sequential" / .sqlog) has a single `trace`, not `traces`
            traces = [ fileContents.trace ];
        }

        if ( fileContents.file_schema === qlog03.FileSchema.sequential ) {
            // .sqlog (JSON Text Sequences, RFC 7464) are RS-delimited records, not a
            // single parseable JSON document, so this loader can only work with an
            // already-reassembled { file_schema, trace: { events: [...] } } object.
            // TextSequenceJSONToQlog does exactly that reassembly at the file-reading
            // layer before handing off to QlogLoader.fromJSON; this branch otherwise
            // only serves whatever else constructs that shape directly.
            console.log("QlogLoaderV3: file_schema is 'sequential' (.sqlog / JSON Text Sequences); reading the pre-assembled trace.");
        }

        if ( !traces ) {
            console.error("QlogLoaderV3: qlog file has neither 'traces' nor 'trace'!", fileContents);

            return group;
        }

        for ( const jsontrace of traces ){

            const qlogconnections:Array<QlogConnection> = new Array<QlogConnection>();

            if ( (jsontrace as qlog03.ITraceError).error_description !== undefined ) {
                const errorTrace = jsontrace as qlog03.ITraceError;

                const conn = new QlogConnection(group);
                conn.title = "ERROR";
                conn.description = (errorTrace.uri || "") + " : " + errorTrace.error_description;
                continue;
            }

            const trace = jsontrace as qlog03.ITrace;

            if ( !trace.events ) {
                console.error("QlogLoaderV3: trace has no 'events' array (likely file_schema 'sequential' / .sqlog, not yet supported by this loader)", trace);
                continue;
            }

            // group_id can be used to multiplex several logical entities (e.g.,
            // several connections) inside a single trace (main-schema-14, 7.3).
            // Unlike draft-02, there is no event_fields/array-style encoding anymore:
            // events are always plain JSON objects.
            let needsSplit = false;

            const commonGroupID = trace.common_fields && trace.common_fields.group_id;

            if ( !commonGroupID && trace.events.length > 0 && (trace.events[0] as any).group_id !== undefined ) {
                needsSplit = true;
            }

            if ( needsSplit ) {

                const groupLUT:Map<string, QlogConnection> = new Map<string, QlogConnection>();

                for ( const event of trace.events ) {

                    if ( !event || Object.keys(event).length === 0 ) {
                        continue; // allow an empty trailing element to get around trailing comma restrictions in JSON
                    }

                    let groupID = (event as any).group_id;

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

                    conn.getEvents().push( event as any );
                }
            }
            else {
                const conn = new QlogConnection(group);
                qlogconnections.push( conn );
                conn.setEvents( trace.events as any );

                const lastEvent = trace.events[ trace.events.length - 1 ];
                if ( lastEvent && Object.keys(lastEvent).length === 0 ) {
                    conn.getEvents().splice( trace.events.length - 1, 1 );
                }
            }

            // component connections share most properties of the overlapping parent trace
            for ( const connection of qlogconnections ){

                connection.title += trace.title ? trace.title : "";
                connection.description += trace.description ? trace.description : "";

                connection.vantagePoint = (trace.vantage_point || {}) as any;

                if ( !connection.vantagePoint.type ){
                    connection.vantagePoint.type = qlog03.VantagePointType.unknown;
                    connection.vantagePoint.flow = qlog03.VantagePointType.unknown;
                    connection.vantagePoint.name = "No VantagePoint set";
                }

                // cast: this draft's ICommonFields doesn't line up field-for-field with
                // the draft-02 type that QlogConnection.commonFields is typed as, but the
                // parser below reads it dynamically, so this is just a label mismatch.
                connection.commonFields = (trace.common_fields || {}) as any;
                connection.configuration = {}; // no `configuration` object in this draft (time is always ms)

                connection.setEventParser( new DirectEventParserV3() );

                // quic-events-13/h3-events-13 renamed parameters_set's `owner` field to
                // `initiator` (same "local"/"remote" values). Several renderers
                // (CongestionGraphD3Renderer, StatisticsConnectionRenderer,
                // PacketizationQUICPreProcessor) still read `data.owner` directly, so we
                // mirror `initiator` onto `owner` here rather than touching every renderer.
                for ( const evt of connection.getEvents() ){
                    const parsedEvt = connection.parseEvent(evt);

                    if ( parsedEvt.name === "parameters_set" && parsedEvt.data &&
                         parsedEvt.data.owner === undefined && parsedEvt.data.initiator !== undefined ) {
                        parsedEvt.data.owner = parsedEvt.data.initiator;
                    }

                    // quic-events-13 renamed the symbolic error field on ConnectionClose/
                    // ResetStream/StopSending frames from `error_code` to `error` (the new
                    // `error_code` is only used for the raw numeric value when `error` is
                    // "unknown"). It also merged draft-02's two CLOSE frame_types
                    // ("connection_close" and "application_close") into a single
                    // "connection_close", distinguished by `error_space` instead.
                    // SequenceDiagramD3Renderer reads `frame.error_code` on all three frame
                    // types expecting the symbolic value, so mirror `error` onto
                    // `error_code` when the latter isn't already set.
                    const frames:Array<any> | undefined = parsedEvt.data && parsedEvt.data.frames;
                    if ( frames ) {
                        for ( const frame of frames ) {
                            if ( frame &&
                                 ( frame.frame_type === "connection_close" || frame.frame_type === "reset_stream" || frame.frame_type === "stop_sending" ) &&
                                 frame.error_code === undefined && frame.error !== undefined ) {
                                frame.error_code = frame.error;
                            }

                            // StreamFrame dropped its top-level `length` field entirely in
                            // quic-events-13 (it's only in `raw.length` now; `offset` stayed).
                            // MultiplexingGraphD3ByterangesRenderer and
                            // MultiplexingGraphD3CollapsedRenderer both read `frame.length`
                            // directly to place stream data in the multiplexing graph, so
                            // backfill it from raw.length when missing.
                            if ( frame && frame.frame_type === "stream" &&
                                 frame.length === undefined && frame.raw && frame.raw.length !== undefined ) {
                                frame.length = frame.raw.length;
                            }
                        }
                    }

                    // h3-events-13's HTTP3PriorityUpdateFrame dropped the old experimental
                    // `element_id`/`value` fields in favor of proper `stream_id`/`push_id`
                    // + `priority_field_value`. MultiplexingGraphD3WaterfallRenderer reads
                    // `data.frame.element_id`/`.value` (frame_created/frame_parsed carry a
                    // single `data.frame`, not an array), so mirror the new fields onto the
                    // old ones it expects.
                    const h3Frame:any = parsedEvt.data && parsedEvt.data.frame;
                    if ( h3Frame && h3Frame.frame_type === "priority_update" ) {
                        if ( h3Frame.element_id === undefined ) {
                            h3Frame.element_id = h3Frame.stream_id !== undefined ? h3Frame.stream_id : h3Frame.push_id;
                        }
                        if ( h3Frame.value === undefined && h3Frame.priority_field_value !== undefined ) {
                            h3Frame.value = h3Frame.priority_field_value;
                        }
                    }

                    // h3-events-13 renamed the HTTP3UnknownFrame field that holds the raw
                    // numeric frame type from `raw_frame_type` to `frame_type_bytes`.
                    // PacketizationDiagramModels reads `frame.raw_frame_type` to size
                    // unknown/extension frames.
                    if ( h3Frame && h3Frame.frame_type === "unknown" &&
                         h3Frame.raw_frame_type === undefined && h3Frame.frame_type_bytes !== undefined ) {
                        h3Frame.raw_frame_type = h3Frame.frame_type_bytes;
                    }
                }

                // same sanity check as QlogLoaderV2: qlog requires absolutely ordered timestamps
                let misOrdered = false;
                let minimumTime = -1;
                for ( const evt of connection.getEvents() ){
                    const parsedEvt = connection.parseEvent(evt);

                    if ( parsedEvt.absoluteTime >= minimumTime ){
                        minimumTime = parsedEvt.absoluteTime;
                    }
                    else {
                        misOrdered = true;
                        console.error("QlogLoaderV3: timestamps were not in the correct order!", parsedEvt.absoluteTime, " < ", minimumTime, parsedEvt);
                        break;
                    }
                }

                if ( misOrdered ){
                    connection.getEvents().sort( (a, b) => { return connection.parseEvent(a).absoluteTime - connection.parseEvent(b).absoluteTime });
                    connection.setEventParser( new DirectEventParserV3() );

                    console.error("QlogLoaderV3: manually sorted trace on timestamps!", connection.getEvents());
                    alert("Loaded trace was not absolutely ordered on event timestamps. We performed a sort() in qvis, but this slows things down and isn't guaranteed to be stable if the timestamps aren't unique! The qlog spec requires absolutely ordered timestamps. See the console for more details.");
                }
            }
        }

        return group;
    }
}

// tslint:disable max-classes-per-file
export class DirectEventParserV3 implements IQlogEventParser {

    // this draft defines Event.time as always being a float64 number of
    // milliseconds (main-schema-14, section 1.2): no more time_units/us handling
    private readonly timeMultiplier:number = 1;

    private timeTrackingMethod = TimeTrackingMethod.ABSOLUTE_TIME;

    private addTime:number = 0;
    private subtractTime:number = 0;
    private _timeOffset:number = 0;

    private currentEvent:IQlogRawEvent|undefined|any;

    public get relativeTime():number {
        if ( this.currentEvent === undefined || this.currentEvent.time === undefined ) {
            return 0;
        }

        return parseFloat(this.currentEvent!.time) * this.timeMultiplier - this.subtractTime + this._timeOffset;
    }

    public get absoluteTime():number {
        if ( this.currentEvent === undefined || this.currentEvent.time === undefined ) {
            return 0;
        }

        return parseFloat(this.currentEvent!.time) * this.timeMultiplier + this.addTime + this._timeOffset;
    }

    public getAbsoluteStartTime():number {
        if ( this.timeTrackingMethod === TimeTrackingMethod.RELATIVE_TIME ){
            return this.addTime;
        }
        else if ( this.timeTrackingMethod === TimeTrackingMethod.ABSOLUTE_TIME ){
            return this.subtractTime;
        }
        else {
            console.error("QlogLoaderV3: No proper startTime present in qlog file.");

            return 0;
        }
    }

    public get timeOffset():number {
        return this._timeOffset;
    }

    // category:type collapsed into a single namespace in this draft (e.g.,
    // "quic:packet_sent" instead of "transport:packet_sent"), so we go through
    // EventNameMapping to recover the legacy (category, name) pair that qvis's
    // renderers key their EventCategory.* / lookup() calls off of. Events with
    // no legacy equivalent fall back to the raw namespace/type split.
    public get category():string {
        if ( this.currentEvent === undefined || this.currentEvent.name === undefined ) {
            return "unknown";
        }

        const mapping = qlog03.EventNameMapping[ this.currentEvent.name ];
        if ( mapping ) {
            return mapping.category;
        }

        return this.currentEvent.name.split(":")[0];
    }

    public get name():string {
        if ( this.currentEvent === undefined || this.currentEvent.name === undefined ) {
            return "unknown";
        }

        const mapping = qlog03.EventNameMapping[ this.currentEvent.name ];
        if ( mapping ) {
            return mapping.name;
        }

        const split = this.currentEvent.name.split(":");

        return split.length > 1 ? split[1] : split[0];
    }

    public set name(val:string) {
        if ( this.currentEvent === undefined || this.currentEvent.name === undefined ) {
            return;
        }

        // operates on the raw "namespace:event_type" string (not the
        // legacy-mapped name), so this only reliably works for events whose
        // new-draft type name matches their legacy name (true for most, see
        // EventNameMapping for the renamed exceptions)
        const split = this.currentEvent.name.split(":");
        const rawName = split.length > 1 ? split[1] : split[0];

        this.currentEvent.name = this.currentEvent.name.replace( rawName, val );
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

        const commonFields:any = trace.commonFields || {};

        let timeTrackingMethod:TimeTrackingMethod;

        if ( commonFields.time_format === qlog03.TimeFormat.relative_to_previous_event ) {
            timeTrackingMethod = TimeTrackingMethod.DELTA_TIME;
        }
        else if ( commonFields.reference_time !== undefined ) {
            // relative_to_epoch is the default time_format when reference_time is set
            timeTrackingMethod = TimeTrackingMethod.RELATIVE_TIME;
        }
        else {
            // no reference_time at all: treat timestamps as already zero-based
            timeTrackingMethod = TimeTrackingMethod.ABSOLUTE_TIME;
        }

        if ( timeTrackingMethod === TimeTrackingMethod.ABSOLUTE_TIME ){
            this.addTime = 0;
            this.subtractTime = parseFloat( (trace.getEvents()[0] as any)!.time );
        }
        else if ( timeTrackingMethod === TimeTrackingMethod.RELATIVE_TIME ) {
            this.addTime = this.parseReferenceTime( commonFields.reference_time );
            this.subtractTime = 0;
        }
        else { // DELTA_TIME, i.e., relative_to_previous_event
            // each event's timestamp is relative to the previous one: pre-process
            // into absolute timestamps once, then treat as ABSOLUTE_TIME from then on
            timeTrackingMethod = TimeTrackingMethod.ABSOLUTE_TIME;

            const allEvents = trace.getEvents();
            if ( !allEvents || allEvents.length === 0 ) {
                console.error("QlogLoaderV3: relative_to_previous_event requires all events to be set before setEventParser is called... was not the case here!");
            }
            else {
                if ( commonFields.reference_time !== undefined ) {
                    this.addTime = 0;
                    this.subtractTime = this.parseReferenceTime( commonFields.reference_time );
                    (allEvents[0] as any).time = parseFloat( (allEvents[0] as any).time ) + this.subtractTime;
                }
                else {
                    this.addTime = 0;
                    this.subtractTime = parseFloat( (allEvents[0] as any).time );
                }

                let previousTime = this.subtractTime;
                for ( let i = 1; i < allEvents.length; ++i ) {
                    (allEvents[i] as any).time = parseFloat((allEvents[i] as any).time) + previousTime;
                    previousTime = (allEvents[i] as any).time;
                }
            }
        }

        this.timeTrackingMethod = timeTrackingMethod;
    }

    public setReferenceTime( time_ms:number ) : void {
        this.addTime = time_ms;
    }

    public load( evt:IQlogRawEvent ) : IQlogEventParser {
        this.currentEvent = evt;

        return this;
    }

    // ReferenceTime.epoch is either an RFC3339 datetime string or the literal
    // "unknown" (main-schema-14, 7.1). Date.parse() handles RFC3339 well enough
    // in practice; this always yields milliseconds, matching Event.time's unit.
    protected parseReferenceTime( refTime:qlog03.IReferenceTime|undefined ) : number {
        if ( !refTime || refTime.epoch === undefined || refTime.epoch === "unknown" ) {
            return 0;
        }

        const parsed = Date.parse( refTime.epoch );

        return isNaN(parsed) ? 0 : parsed;
    }
}
