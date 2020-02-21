import * as qlogschema from '@quictools/qlog-schema';
import * as tcpschema from './qlog_tcp_tls_h2';

interface TCPConnection {
    qlog:qlogschema.ITrace,
}

enum Direction {
    sending = "sending",
    receiving = "receiving",
}

export default class TCPToQlog {

    public static convert( pcapJSON:any ) {

        console.log("TCPToQlog: converting file with " + pcapJSON.length + " events");

        const qlogFile:qlogschema.IQLog = { qlog_version: "draft-02-wip", traces: new Array<qlogschema.ITrace>() };
        const connectionMap:Map<string, TCPConnection> = new Map<string, TCPConnection>();

        TCPToQlog.timestampTracker.set(Direction.sending, { time: -1, seq: -1});
        TCPToQlog.timestampTracker.set(Direction.receiving, { time: -1, seq: -1} );

        
        for ( const entry of pcapJSON ) {

            if ( !entry._source || !entry._source.layers || !entry._source.layers.ip || !entry._source.layers.tcp ){
                console.error("Bad entry in JSON, skipping", entry._source.layers);
                continue;
            }

            const IP = entry._source.layers.ip;
            const TCP = entry._source.layers.tcp;


            let connection:TCPConnection|undefined = connectionMap.get( IP["ip.src"] + ":" + TCP["tcp.srcport"] );
            let direction:Direction = Direction.sending;

            if ( !connection ) {
                connection = connectionMap.get( IP["ip.dst"] + ":" + TCP["tcp.dstport"] );
                direction = Direction.receiving;
            }

            if ( !connection ) {
                // create new connection (always initiated from the client)
                direction = Direction.sending;

                connection = { qlog: {  vantage_point: { type: qlogschema.VantagePointType.client }, 
                                        event_fields: ["time", "category", "event", "data"],
                                        common_fields: { protocol_type: "TCP_HTTP2" },
                                        events: new Array<Array<qlogschema.EventField>>(), 
                                    }, 
                             }; 
                                 
                connectionMap.set( IP["ip.src"] + ":" + TCP["tcp.srcport"], connection );

                console.log("Created new connection #", connectionMap.size, IP["ip.src"] + ":" + TCP["tcp.srcport"], " => ", IP["ip.dst"] + ":" + TCP["tcp.dstport"] );


                // TODO: add new connectivity event
            }

            this.addEntry( connection, direction, entry._source.layers );
        }

        for ( const connection of connectionMap.values() ) {

            // we fix the ordering per Direction in the addEntry function, but between directions, there are still problems
            connection.qlog.events.sort( (a, b) => { return (a[0] as number) - (b[0] as number) });
            
            // this code is mainly for debugging to make sure the above sorting actually works
            // TODO: refactor to a map on event type instead of 2 hardcoded seqNr keepers
            let prevSentSeqNr = -1;
            let prevRecvSeqNr = -1;
            for ( const evti of connection.qlog.events ){
                const evt:any = evti as any;

                if ( evt[2] === "packet_sent" ) {
                    if ( evt[3].header && evt[3].sequence_number ){
                        if ( evt[3].sequence_number < prevSentSeqNr ){
                            console.error("BADLY ORDERED SEQ NRS send");
                        }

                        prevSentSeqNr = evt[3].sequence_number;
                    }
                }
                else if (evt[2] === "packet_received" ) {
                    if ( evt[3].header && evt[3].sequence_number ){
                        if ( evt[3].sequence_number < prevRecvSeqNr ){
                            console.error("BADLY ORDERED SEQ NRS recv");
                        }

                        prevRecvSeqNr = evt[3].sequence_number;
                    }
                }
            }

            qlogFile.traces.push( connection.qlog );
        }

        console.log("TCPToQlog : done converting pcap");

        return qlogFile;
    }

    protected static timestampTracker:Map<Direction, {time: number, seq: number}> = new Map<Direction, {time: number, seq: number}>();
    protected static addEntry( connection:TCPConnection, direction:Direction, entry:any ) {

        // console.log( entry.frame );

        let timestamp = parseFloat( entry.frame['frame.time_epoch']);

        // timestamps are often badly ordered for us... SYN/ACK supposedly arrives long after the ACK reply...
        // so, we use frame.number instead, since the ordering in the file seems to be correct at least
        // timestamp = parseInt( entry.frame["frame.number"], 10 );

        const seqNr = parseInt( entry.tcp["tcp.seq"], 10 );

        // this should NEVER happen
        if ( seqNr < TCPToQlog.timestampTracker.get(direction)!.seq ) {   
            console.error("UNORDERED SEQ NUMBERS", timestamp, " : ", seqNr, " < ", TCPToQlog.timestampTracker.get(direction));
        }

        if ( timestamp < TCPToQlog.timestampTracker.get(direction)!.time ){
            // if timestamps are off, at least make sure the sequence numbers are correct (i.e., order in JSON is ok, its just the timestamps that are borked)
            if ( seqNr > TCPToQlog.timestampTracker.get(direction)!.seq ) {
                timestamp = TCPToQlog.timestampTracker.get(direction)!.time + 0.000001; // pretend everything arrived at +- the same time
                console.warn("Mismatched timestamps, but sequence numbers were correctly ordered: faking timestamp instead");
    
                TCPToQlog.timestampTracker.set(direction, { time: timestamp, seq: seqNr } );
            }
            else {
                console.error("UNORDERED TIMESTAMPS", timestamp, " : ", seqNr, " < ", TCPToQlog.timestampTracker.get(direction));
            }
        }
        else {
            // normal case: timestamps are well-ordered
            TCPToQlog.timestampTracker.set(direction, { time: timestamp, seq: seqNr } );
        }

        // TCP packet info
        {
            const TCP = entry.tcp;

            const qlogEvent:Array<qlogschema.EventField> = new Array<qlogschema.EventField>();
            qlogEvent.push( timestamp );
            qlogEvent.push( tcpschema.EventCategory.tcp );
            
            if ( direction === Direction.sending ) {
                qlogEvent.push( tcpschema.TCPEventType.packet_sent );
            }
            else {
                qlogEvent.push( tcpschema.TCPEventType.packet_received );
            }
    
            // packetSent and Received are basically the same, just use Sent here
            const packetSent:tcpschema.IEventPacketSent = {
                header: {
                    packet_number:   parseInt(entry.frame["frame.number"], 10),
                    sequence_number: parseInt(TCP["tcp.seq"], 10),
                    payload_length:  parseInt(TCP["tcp.len"], 10),
                    header_length:   parseInt(TCP["tcp.hdr_len"], 10),
                    
                    packet_size:     parseInt(TCP["tcp.hdr_len"], 10) + parseInt(TCP["tcp.len"], 10),
                },
            }
    
            qlogEvent.push( packetSent );
    
            connection.qlog.events.push ( qlogEvent );
        }

        // sometimes. entry.tls is just the string "Transport Layer Security"... no idea why
        if ( entry.tls && typeof entry.tls !== "string" ) {
            let TLS = entry.tls;

            // tshark is INREDIBLY inconsistent with how it groups tls records
            // sometimes there are multiple entries in the TLS top level object,
            // sometimes the "tls.record" field is an array
            const records = new Array<any>();

            const extractRecords = (obj:any) => {
                if ( obj["tls.record"] ){
                    if ( Array.isArray(obj["tls.record"]) ) {
                        for ( const el of obj["tls.record"] ) {
                            extractRecords( el );
                        }
                    }
                    else {
                        records.push ( obj["tls.record"] );
                    }
                }
                else if ( obj["tls.record.length"] ) {
                    records.push ( obj );
                }
                else {
                    for ( const el of obj ) {
                        extractRecords( el );
                    }
                }
            };

            if ( TLS.length && TLS.length === 2 ){
                // sometimes, we weirdly have two TLS entries but the second one is empty...
                if ( Object.keys(TLS[1]).length === 0 ) {
                    extractRecords( TLS[0] );
                } 
                else {

                    extractRecords( TLS );

                    // we get this if there are multiple application-data records in a a single TCP frame (e.g., the end of a previous record and a full new one)
                    // for some reason, it doesn't make the "tls.record" into an array, but "tls" itself...
                    // So, make them into proper tls.record array and deal with that later
                    // if ( TLS[0]["tls.record"] && TLS[1]["tls.record"] ) {
                    //     const records = new Array<any>();
                    //     records.push( TLS[0]["tls.record"] );
                    //     // tslint:disable-next-line:one-variable-per-declaration
                    //     const test = Array.isArray(TLS[1]["tls.record"]) ? ...(TLS[1]["tls.record"]) : TLS[1]["tls.record"];
                    //     records.push( 
                    //         test,
                    //     );

                    //     const segments = new Array<any>();
                    //     segments.push( TLS[0]["tls.segment.data"] );
                    //     segments.push( TLS[1]["tls.segment.data"] );

                    //     TLS[0]["tls.record"] = records;
                    //     TLS[0]["tls.segment.data"] = segments;
                    //     TLS = TLS[0];
                    // }

                    console.warn("tcptoqlog: Merged two TLS entries into one, typically because there were two application-data records together. Should be fine.", records, TLS );
                }
            }
            else if ( TLS.length && TLS.length > 2 ) {
                console.error("tcptoqlog: More than two TLS entries... what is happening?", TLS );
                extractRecords( TLS );
            }
            else {
                extractRecords( TLS );
            }


            if ( records.length === 0 ) {
                console.error("tcptoqlog: No tls.record... what is happening?", TLS );

                return;
            }

            for ( const record of records ) {
                
                const qlogEvent:Array<qlogschema.EventField> = new Array<qlogschema.EventField>();
                qlogEvent.push( timestamp );
                qlogEvent.push( tcpschema.EventCategory.tls );
                
                if ( direction === Direction.sending ) {
                    qlogEvent.push( tcpschema.TLSEventType.record_created );
                }
                else {
                    qlogEvent.push( tcpschema.TLSEventType.record_parsed );
                }

                let content_type:"handshake"|"alert"|"application"|"change-cipherspec"|"unknown" = "unknown";
                if ( record["tls.record.content_type"] === "23" ) {
                    content_type = "application";
                }
                else if ( record["tls.record.content_type"] === "22" ) {
                    content_type = "handshake";
                }
                else if ( record["tls.record.content_type"] === "21" ) {
                    content_type = "alert";
                }
                else if ( record["tls.record.content_type"] === "20" ) {
                    content_type = "change-cipherspec";
                }

                if ( !record["tls.record.length"] ) {
                    console.error("no tls.record.length set... weird", record);
                }
                
                const recordLength = parseInt(record["tls.record.length"], 10);
                let appDataLength = -1; 
                if ( record["tls.app_data"] ) { 
                    appDataLength = (record["tls.app_data"].length + 1) / 3;

                    if ( appDataLength !== recordLength ) {
                        console.error("tcptoqlog: Record length is different from app_data length", recordLength, appDataLength, record, TLS);
                    }
                }

                if ( content_type === "application" && appDataLength === -1 ) {
                    console.error("tcptoqlog: TLS application record without app data... weird?", record, TLS);
                }

                let trailerSize = 0;
                if ( content_type === "application" ) {
                    // MAC at the end... hardcoded at 16 for now, will bite us in the ass later no doubt
                    // only for application-data records, as only those mess with HTTP/2 size calculations, we don't really care about handshake records at this point
                    trailerSize = 16;
                }

                // recordCreated and recordParsed are basically the same, just use Sent here
                const packetSent:tcpschema.IEventRecordCreated = {
                    header: {
                        content_type:   content_type,
                        header_length: 5, // TLS record header length is always 5
                        trailer_length: trailerSize, 
                        payload_length: recordLength - trailerSize,
                    },
                }
        
                qlogEvent.push( packetSent );
        
                connection.qlog.events.push ( qlogEvent );

                if ( entry.http2 ) {
                    console.log("RECORDS", parseInt( (qlogEvent[3] as any).header.payload_length, 10) );
                }
            }

        }

        // sometimes. entry.http2 is just the string "HyperText Transport Protocol 2"... no idea why
        if ( entry.http2 && typeof entry.http2 !== "string" ) {

            const HTTP = entry.http2;

            const frames = new Array<any>();

            const extractFrames = (obj:any) => {
                if ( Object.keys(obj).length === 0 ) { // for some reason, there are often empty entries here... skip them
                    console.warn("tcp2qlog: empty HTTP/2 frame... ignoring");

                    return;
                }

                // the magic number is part of the payload, but wireshark doesn't show its length or anything... dreadful
                if ( obj["http2.magic"] ) {
                    obj["http2.length"] = "24"; // always 24 octets long, per-spec (PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n)
                    obj["http2.type"]   = "magic";
                }

                if ( obj["http2.stream"] ) {
                    if ( Array.isArray(obj["http2.stream"]) ) {
                        for ( const el of obj["http2.stream"] ){
                            extractFrames(el);
                        }
                    }
                    else {
                        frames.push( obj["http2.stream"] );
                    }
                }
                else if ( obj["http2.length"] ){ // member of http2.stream. NOt named http2.stream.length because wireshark is wildly inconsistent
                    frames.push ( obj );
                }
                else {
                    for ( const el of obj ) {
                        extractFrames( el );
                    }
                }
            };

            extractFrames( HTTP );

            // console.log("HTTP2 FRAMES", frames);
            // I THINK: HTTP2 frame header is always 9, so that * amount of frames + 16 bytes of MAC/nonce at the end
            console.log("HTTP2 FRAMESIZES", frames.map( (frame) => parseInt(frame["http2.length"], 10) + 9), frames.reduce( (prev, cur) => prev + (parseInt(cur["http2.length"], 10) + 9), 0), frames);

            // COULD be there is some leftover goodness in there though... e.g., full h2 frame, then just 9 bytes of the next : that could give us weird measurements, right?
            // so, just ignore this and if everything adds up over time, stuff is ok, right? RIGHT!

            for ( const frame of frames ) {
                
                const qlogEvent:Array<qlogschema.EventField> = new Array<qlogschema.EventField>();
                qlogEvent.push( timestamp );
                qlogEvent.push( tcpschema.EventCategory.http2 );
                
                if ( direction === Direction.sending ) {
                    qlogEvent.push( tcpschema.HTTP2EventType.frame_created );
                }
                else {
                    qlogEvent.push( tcpschema.HTTP2EventType.frame_parsed );
                }
                
                const frameLength = parseInt( frame["http2.length"], 10);
                let headerLength = 0;
                if ( frame["http2.type"] !== "magic" ) {
                    headerLength = 9;
                }

                // frameCreated and frameParsed are basically the same, just use Sent here
                const frameSent:tcpschema.IEventH2FrameCreated = {
                    stream_id: parseInt( frame["http2.stream_id"], 10 ),
                    payload_length: frameLength,
                    header_length: headerLength,

                    frame: { frame_type: tcpschema.HTTP2FrameTypeName.unknown },
                }
        
                qlogEvent.push( frameSent );
        
                connection.qlog.events.push ( qlogEvent );
            }
        }
    }
}
