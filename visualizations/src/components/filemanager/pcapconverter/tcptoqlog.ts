/* tslint:disable */

import * as qlogschema from '@/data/QlogSchema01';
import * as tcpschema from './qlog_tcp_tls_h2';

interface TCPConnection {
    qlog:qlogschema.ITrace,
    DEBUG_originalEntries:Array<any>,
    probable_url:string|undefined, // guessed from the HTTP/2 :authority header
    TLSAppDataTrailerSize:number|undefined,
    TLSRecordsToBeAdjustedForTrailerSize:Array<any>,


    DEBUG_HTTPtotalSize:number,
    DEBUG_TLSpayloadSize:number,

    timestampTracker:Map<Direction, {time: number, seq: number}>,
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
        

        for ( const entry of pcapJSON ) {

            if ( !entry._source || !entry._source.layers || (!entry._source.layers.ip && !entry._source.layers.ipv6) || !entry._source.layers.tcp ){
                // console.error("Bad entry in JSON, skipping", entry._source.layers);
                // this is normal behaviour if we just dump a wireshark trace as a whole: will contain other protocols such as DNS as well, which we're not interested in here
                continue;
            }

            let IP = entry._source.layers.ip;
            let IPsrcField = "ip.src";
            let IPdstField = "ip.dst";
            if ( !IP ) {
                IP = entry._source.layers.ipv6;
                IPsrcField = "ipv6.src";
                IPdstField = "ipv6.dst";
            }
                
            const TCP = entry._source.layers.tcp;


            let connection:TCPConnection|undefined = connectionMap.get( IP[IPsrcField] + ":" + TCP["tcp.srcport"] );
            let direction:Direction = Direction.sending;

            if ( !connection ) {
                connection = connectionMap.get( IP[IPdstField] + ":" + TCP["tcp.dstport"] );
                direction = Direction.receiving;
            }

            if ( !connection ) {
                // create new connection (always initiated from the client)
                direction = Direction.sending;

                connection = { qlog: {  vantage_point: { type: qlogschema.VantagePointType.client }, 
                                        event_fields: ["time", "category", "event", "data"],
                                        common_fields: { protocol_type: "TCP_HTTP2" },
                                        events: new Array<Array<qlogschema.EventField>>(), 
                                        title: "" + IP[IPsrcField] + ":" + TCP["tcp.srcport"] + " -> " + IP[IPdstField] + ":" + TCP["tcp.dstport"],
                                    }, 
                                DEBUG_originalEntries: [],
                                probable_url: undefined,
                                TLSAppDataTrailerSize: undefined,
                                TLSRecordsToBeAdjustedForTrailerSize: new Array<any>(),

                                DEBUG_HTTPtotalSize: 0,
                                DEBUG_TLSpayloadSize: 0,
                                timestampTracker: new Map<Direction, {time: number, seq: number}>(),
                             }; 

                

                connection.timestampTracker.set(Direction.sending, { time: -1, seq: -1});
                connection.timestampTracker.set(Direction.receiving, { time: -1, seq: -1} );
                                 
                connectionMap.set( IP[IPsrcField] + ":" + TCP["tcp.srcport"], connection );

                console.log("Created new connection #", connectionMap.size, IP[IPsrcField] + ":" + TCP["tcp.srcport"], " => ", IP[IPdstField] + ":" + TCP["tcp.dstport"] );


                // TODO: add new connectivity event
            }

            this.addEntry( connection, direction, entry._source.layers );
            connection.DEBUG_originalEntries.push( entry );
        }

        for ( const connection of connectionMap.values() ) {

            if ( connection.probable_url ) {
                connection.qlog.title += " => " + connection.probable_url;
            }
            else {
                connection.qlog.title += " => Unknown URL";
            }

            if ( !connection.TLSAppDataTrailerSize ) {
                console.error("TCPToQlog: unable to estimate TLS trailer size from this trace... " + connection.qlog.title);
            }
            else {
                connection.qlog.title += " @ " + connection.TLSAppDataTrailerSize + " TLS trailer size";
            }

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

            if ( connection.DEBUG_HTTPtotalSize !== connection.DEBUG_TLSpayloadSize ) {
                console.error("HTTP doesn't fully fill TLS", "TLS: ", connection.DEBUG_TLSpayloadSize, "HTTP: ", connection.DEBUG_HTTPtotalSize, connection.DEBUG_TLSpayloadSize - connection.DEBUG_HTTPtotalSize );
            }
        }

        console.warn("TCPToQlog: remember to add support for HTTP/2 padding to be fully compliant!");
        console.log("TCPToQlog : done converting pcap", connectionMap.values());


        return qlogFile;
    }

    protected static addEntry( connection:TCPConnection, direction:Direction, entry:any ) {

        // console.log( entry.frame );

        let timestamp = parseFloat( entry.frame['frame.time_epoch']);

        // timestamps are often badly ordered for us... SYN/ACK supposedly arrives long after the ACK reply...
        // so, we use frame.number instead, since the ordering in the file seems to be correct at least
        // timestamp = parseInt( entry.frame["frame.number"], 10 );

        const seqNr = parseInt( entry.tcp["tcp.seq"], 10 );

        // this should NEVER happen
        if ( seqNr < connection.timestampTracker.get(direction)!.seq ) {   
            console.error("UNORDERED SEQ NUMBERS", timestamp, " : ", seqNr, " < ", connection.timestampTracker.get(direction));
            // alert("UNORDERED TCP SEQ NUMBERS");
        }

        if ( timestamp < connection.timestampTracker.get(direction)!.time ){
            // if timestamps are off, at least make sure the sequence numbers are correct (i.e., order in JSON is ok, its just the timestamps that are borked)
            if ( seqNr > connection.timestampTracker.get(direction)!.seq ) {
                timestamp = connection.timestampTracker.get(direction)!.time + 0.000001; // pretend everything arrived at +- the same time
                console.warn("Mismatched timestamps, but sequence numbers were correctly ordered: faking timestamp instead");
    
                connection.timestampTracker.set(direction, { time: timestamp, seq: seqNr } );
            }
            else {
                console.error("UNORDERED TIMESTAMPS", timestamp, " : ", seqNr, " < ", connection.timestampTracker.get(direction));
            }
        }
        else {
            // normal case: timestamps are well-ordered
            connection.timestampTracker.set(direction, { time: timestamp, seq: seqNr } );
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
                    packet_type:     qlogschema.PacketType.onertt, // TCP can be considered as always QUIC's 1RTT equivalent
                    packet_number:   parseInt(entry.frame["frame.number"], 10),
                    sequence_number: parseInt(TCP["tcp.seq"], 10),
                    payload_length:  parseInt(TCP["tcp.len"], 10),
                    header_length:   parseInt(TCP["tcp.hdr_len"], 10),
                },

                raw: {
                    length:     parseInt(TCP["tcp.hdr_len"], 10) + parseInt(TCP["tcp.len"], 10),
                },
            }
    
            qlogEvent.push( packetSent as any );
    
            connection.qlog.events.push ( qlogEvent );
        }

        let TLS = undefined;
        let HTTP = undefined;

        // we extract the TLS records and HTTP2 frames first, as we need the H2 frames to calculate possible TLS trailer size
        const TLSrecords = new Array<any>();
        const HTTPframes = new Array<any>();

        // sometimes. entry.tls is just the string "Transport Layer Security"... no idea why
        if ( entry.tls && typeof entry.tls !== "string" ) {
            TLS = entry.tls;

            // tshark is INREDIBLY inconsistent with how it groups tls records
            // sometimes there are multiple entries in the TLS top level object,
            // sometimes the "tls.record" field is an array

            const extractRecords = (obj:any) => {
                if ( Object.keys(obj).length === 0 ) { // for some reason, there are often empty entries here... skip them

                    // we THINK it only happens if there are multiple TLS record segments in 1 TCP and the latter record is enough to decode part of the H2 frame, but not entirely
                    // bit wonky to check automatically if that's the case (because the TLS record decoding from up top is non-deterministic... urgh)
                    console.warn("tcp2qlog: empty TLS record... ignoring", obj, entry);

                    return;
                }

                if ( obj["tls.record"] ){
                    if ( Array.isArray(obj["tls.record"]) ) {
                        for ( const el of obj["tls.record"] ) {
                            extractRecords( el );
                        }
                    }
                    else {
                        TLSrecords.push ( obj["tls.record"] );
                    }
                }
                else if ( obj["tls.record.length"] ) {
                    TLSrecords.push ( obj );
                }
                else {

                    try {
                        for ( const el of obj ) {
                            extractRecords( el );
                        }
                    }
                    catch (e) {
                        console.error("TLS object was not iterable, skipping. Typically only if we have TLS Unknown Record!", obj, entry);
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

                    // console.warn("tcptoqlog: Merged two TLS entries into one, typically because there were two application-data records together. Should be fine.", records, TLS );
                }
            }
            else if ( TLS.length && TLS.length > 2 ) {
                console.error("tcptoqlog: More than two TLS entries... what is happening?", TLS );
                extractRecords( TLS );
            }
            else {
                extractRecords( TLS );
            }


            if ( TLSrecords.length === 0 ) {
                console.error("tcptoqlog: No tls.record... what is happening?", TLS );

                return;
            }
        }

        // sometimes. entry.http2 is just the string "HyperText Transport Protocol 2"... no idea why
        if ( entry.http2 && typeof entry.http2 !== "string" ) {

            HTTP = entry.http2;

            const extractFrames = (obj:any) => {
                if ( Object.keys(obj).length === 0 ) { // for some reason, there are often empty entries here... skip them

                    // we THINK it only happens if there are multiple TLS record segments in 1 TCP and the latter record is enough to decode part of the H2 frame, but not entirely
                    // bit wonky to check automatically if that's the case (because the TLS record decoding from up top is non-deterministic... urgh)
                    console.warn("tcp2qlog: empty HTTP/2 frame... ignoring (expected if TLS record contains a small piece of the H2 frame. Look at the tls.segment.data array contents: 2nd entry should be +- 9 bytes)", entry);

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
                        HTTPframes.push( obj["http2.stream"] );
                    }
                }
                else if ( obj["http2.length"] ){ // member of http2.stream. NOt named http2.stream.length because wireshark is wildly inconsistent
                    HTTPframes.push ( obj );
                }
                // sometimes, one of the entries is just the string "HyperText Transport Protocol 2" and for-of'ing that gives us the individual characters of the string...
                // as this leads to inifite recursion, don't keep looking if it's a string
                else if ( typeof obj !== "string" ) {
                    try{
                        for ( const el of obj ) {
                            extractFrames( el );
                        }
                    }
                    catch (e) {
                        console.error("HTTP/2 object was not iterable, skipping. Haven't seen this before!", obj, entry);
                    }
                }
            };

            extractFrames( HTTP );
        }


        if ( TLS ) {



            // DEBUG: REMOVE
            {
                let recordLength = 0;
                for ( const record of TLSrecords ) {
                    if ( record["tls.record.content_type"]=== "23" ) {
                        recordLength += parseInt(record["tls.record.length"], 10);
                    }
                }

                let httpLength = 0;
                for ( const frame of HTTPframes ) {
                    // if ( frame["http2.type"] === "0" ) {
                    httpLength += parseInt( frame["http2.length"], 10);
                    // }
                }

                if ( Math.abs( recordLength - httpLength ) > 500 ) {
                    console.warn("Weird inconsistencies between frame sizes", recordLength, httpLength, entry);
                }
            }

            for ( const record of TLSrecords ) {
                
                const qlogEvent:Array<qlogschema.EventField> = new Array<qlogschema.EventField>();
                qlogEvent.push( timestamp );
                qlogEvent.push( tcpschema.EventCategory.tls );
                
                if ( direction === Direction.sending ) {
                    qlogEvent.push( tcpschema.TLSEventType.record_created );
                }
                else {
                    qlogEvent.push( tcpschema.TLSEventType.record_parsed );
                }

                let contentTypeValue = "";
                if ( record["tls.record.content_type"] ) {
                    contentTypeValue = record["tls.record.content_type"];
                }
                // keep this off for now, at least for this we know up until where it still works
                // else if ( record["tls.record.opaque_type"] ) { // in some cases with re-ordered packets, content_Type isn't present but opaque_type is... very strange
                //     contentTypeValue = record["tls.record.opaque_type"];
                // }

                let content_type:"handshake"|"alert"|"application"|"change-cipherspec"|"unknown" = "unknown";
                if ( contentTypeValue === "23" ) {
                    content_type = "application";
                }
                else if ( contentTypeValue === "22" ) {
                    content_type = "handshake";
                }
                else if ( contentTypeValue === "21" ) {
                    content_type = "alert";
                }
                else if ( contentTypeValue === "20" ) {
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

                const fullPayloadLength = recordLength; // includes all trailers, but not the 5-byte header
                let totalH2payloadLength = 0;
                for ( const frame of HTTPframes ) {
                    const frameLength = parseInt( frame["http2.length"], 10 );
                    totalH2payloadLength += frameLength + 9;
                }

                // try to find records that contain a full H2 frame in and of itself
                // most connections have at least one of these...
                // proper way would be to match H2 frames across TLS records, but that's a bunch more work, tracking re-assembly across TCP packets etc.
                // this is dirty, but hopefully works well-enough (TM)
                if ( content_type === "application" && TLSrecords.length === HTTPframes.length && fullPayloadLength - totalH2payloadLength > 0 &&
                     !entry["tls.segments"] && !TLS["tls.segment.data"] ){
                    
                    // console.log("TLS payload length vs h2 consituent lengths:", fullPayloadLength, totalH2payloadLength, fullPayloadLength - totalH2payloadLength, TLS, HTTP, entry);

                    const suggestedTrailerSize = fullPayloadLength - totalH2payloadLength;

                    if (suggestedTrailerSize !== 16 &&
                        suggestedTrailerSize  !== 17 && // + 1 because TLS 1.3 repeats content type at the back against padding
                        // suggestedTrailerSize !== 4 && 
                        suggestedTrailerSize !== 8 && 
                        suggestedTrailerSize !== 24) {
                            console.error("TCPToQlog: TLS trailer size is not 16, 17, 8 or 24: potential error! TODO: actually check with negotiated cipher what is expected here!", suggestedTrailerSize);
                    } 
                    else if ( !connection.TLSAppDataTrailerSize ) {
                        connection.TLSAppDataTrailerSize = suggestedTrailerSize;
                        console.log("TCPToQlog: TLS trailer size estimated", connection.TLSAppDataTrailerSize, connection.TLSRecordsToBeAdjustedForTrailerSize, entry);

                        for ( const recordToBeAdjusted of connection.TLSRecordsToBeAdjustedForTrailerSize ) {
                            recordToBeAdjusted.header.trailer_length = connection.TLSAppDataTrailerSize;
                            recordToBeAdjusted.header.payload_length = recordToBeAdjusted.header.payload_length - recordToBeAdjusted.header.trailer_length;

                            if ( recordToBeAdjusted.header.payload_length < 0 ) {
                                console.error("TCPToQlog: adjusting for TLS trailer size lead to negative size...", recordToBeAdjusted);
                            }

                            connection.DEBUG_TLSpayloadSize -= recordToBeAdjusted.header.trailer_length;
                        }

                        connection.TLSRecordsToBeAdjustedForTrailerSize = new Array<any>();
                    }
                    else {
                        if ( connection.TLSAppDataTrailerSize !== fullPayloadLength - totalH2payloadLength ) {
                            console.error("TCPToQlog: guesstimated TLS trailer size was inconsistent", connection.TLSAppDataTrailerSize, "!=", fullPayloadLength - totalH2payloadLength, fullPayloadLength, totalH2payloadLength, TLS, HTTP, entry);
                        }
                    } 
                }


                const trailerSize = (connection.TLSAppDataTrailerSize && content_type === "application") ? connection.TLSAppDataTrailerSize : 0;
                
                // if ( content_type === "application" ) {
                //     // MAC at the end... hardcoded at 16 for now, will bite us in the ass later no doubt
                //     // only for application-data records, as only those mess with HTTP/2 size calculations, we don't really care about handshake records at this point
                //     trailerSize = 16;
                // }

                // if ( record["tls.record.opaque_type"] ){
                //     // In TLS 1.3, there is a 1-byte record type appended to the plaintext (to deal with padding)
                //     // see also https://github.com/wireshark/wireshark/blob/71e03ef0423ef5215f8b4843433dc623ad1df74a/epan/dissectors/packet-tls.c#L1875
                //     // this 1-byte is NOT included in the record.length field, OF COURSE, giving us some weird off-by-one errors before. Took 1.5 days to find this, urgh
                //     trailerSize += 1;
                // } 

                // some defensive programming, since we got hit so hard with the 1-byte opaque_type above
                const expectedRecordFields = ["tls.record.content_type", "tls.record.opaque_type", "tls.record.length", "tls.record.version", "tls.app_data", "tls.handshake", "tls.change_cipher_spec", "tls.handshake.fragments", "tls.alert_message", "tls.reassembled_in", "tls.handshake.reassembled_in"];
                for ( const field of Object.keys(record) ) {
                    if ( expectedRecordFields.indexOf(field) < 0 ) {
                        alert("Unknown field found in TLS record: " + field);
                        console.error("Unknown field found in TLS record: ", field, expectedRecordFields, entry);
                    }
                }

                // recordCreated and recordParsed are basically the same, just use Sent here
                const packetSent:tcpschema.IEventRecordCreated = {
                    header: {
                        packet_type: qlogschema.PacketType.onertt, // QUIC qlog compat mode, not needed
                        packet_number: "", // QUIC qlog compat mode, not needed

                        content_type:   content_type,
                        header_length: 5, // TLS record header length is always 5
                        trailer_length: trailerSize, 
                        payload_length: recordLength - trailerSize,

                        DEBUG_wiresharkFrameNumber: parseInt( entry.frame["frame.number"], 10 ),
                    },
                }

                // re-adjusted these later when we know the actual trailer size
                if ( content_type === "application" && !connection.TLSAppDataTrailerSize ) {
                    connection.TLSRecordsToBeAdjustedForTrailerSize.push ( packetSent );
                }

                if ( packetSent.header.content_type === "application" ) {
                    connection.DEBUG_TLSpayloadSize += recordLength - trailerSize;
                }

                if ( packetSent.header.payload_length === 0 ) {
                    console.error("TLS record without payload... seems weird", record);
                }
        
                qlogEvent.push( packetSent );
        
                connection.qlog.events.push ( qlogEvent );

                // if ( entry.http2 ) {
                //    console.log("RECORDS", parseInt( (qlogEvent[3] as any).header.payload_length, 10) );
                // }
            }

        }

        if ( HTTP ) {
            
            const DEBUG_frameSizeTracker:Array<number> = [];

            for ( const frame of HTTPframes ) {
                // defensive programming: make sure sizes between TLS and HTTP2 match
                // reassembled length is only when we actually had split records. Borks when records nicely fit inside TCP packets, so comment this out for now 
                // {
                //     if ( entry["tls.segments"] && entry["tls.segments"]["tls.reassembled.length"] ){
                //         const reassLength = parseInt( entry["tls.segments"]["tls.reassembled.length"], 10);
                //         const h2Length = parseInt(frame["http2.length"], 10);

                //         if ( reassLength !== h2Length + 9 ) {
                //             console.error("H2 frame doesn't have a header of 9 bytes", entry);
                //         }
                //     }
                //     else {
                //         console.error("HTTP/2 frame not from TLS segments", frame, entry);
                //     }
                // }


                const qlogEvent:Array<qlogschema.EventField> = new Array<qlogschema.EventField>();
                qlogEvent.push( timestamp );
                qlogEvent.push( tcpschema.EventCategory.http2 );
                
                if ( direction === Direction.sending ) {
                    // NOTE: normally, if this would be logged in an implementation, frame_created would be logged BEFORE packet_sent
                    // however, because we're parsing from a pcap, it is logged AFTER the packet_sent... 
                    // this has caused us some grief in the PacketizationDiagram setup, though it's actually easier on the logic if it's logged after
                    // TODO: ideally, though, for consistency, we should refactor this and inject these before the previous packet_sent (does require updates to the TCP packetizationDiagram logic)
                    qlogEvent.push( tcpschema.HTTP2EventType.frame_created );
                }
                else {
                    qlogEvent.push( tcpschema.HTTP2EventType.frame_parsed );
                }

                const typeNrToName = (type:string) => {
                    switch ( type ){
                        case "0":
                            return tcpschema.HTTP2FrameTypeName.data;
                            break;
                        case "1":
                            return tcpschema.HTTP2FrameTypeName.headers;
                            break;
                        case "2":
                            return tcpschema.HTTP2FrameTypeName.priority;
                            break;
                        case "3":
                            return tcpschema.HTTP2FrameTypeName.reset_stream;
                            break;
                        case "4":
                            return tcpschema.HTTP2FrameTypeName.settings;
                            break;
                        case "5":
                            return tcpschema.HTTP2FrameTypeName.push_promise;
                            break;
                        case "6":
                            return tcpschema.HTTP2FrameTypeName.ping;
                            break;
                        case "7":
                            return tcpschema.HTTP2FrameTypeName.go_away;
                            break;
                        case "8":
                            return tcpschema.HTTP2FrameTypeName.window_update;
                            break;
                        case "9":
                            return tcpschema.HTTP2FrameTypeName.continuation;
                            break;
                        case "magic":
                            return tcpschema.HTTP2FrameTypeName.magic;

                        default:
                            return tcpschema.HTTP2FrameTypeName.unknown;
                            break;
                    }
                };
                
                const frameLength = parseInt( frame["http2.length"], 10);
                let headerLength = 0;
                if ( frame["http2.type"] !== "magic" ) {
                    headerLength = 9;
                }

                const frameData = { frame_type: typeNrToName( frame["http2.type"] ) };
                switch (frameData.frame_type) {

                    case tcpschema.HTTP2FrameTypeName.headers:
                        (frameData as tcpschema.IHeadersFrame).headers = new Array<tcpschema.IHTTPHeader>();
                        for ( const header of frame["http2.header"] ) {
                            const h:tcpschema.IHTTPHeader = { name: header["http2.header.name"], value: header["http2.header.value"] };
                            (frameData as tcpschema.IHeadersFrame).headers.push( h );

                            if ( header["http2.header.name"] === ":authority" ) {
                                if ( !connection.probable_url ) {
                                    connection.probable_url = header["http2.header.value"];
                                }
                                else {
                                    if ( connection.probable_url !== header["http2.header.value"] ) {
                                        console.error("Trying to guess URL for connection, but getting conflicting values", header["http2.header.value"], connection );
                                    } 
                                }
                            } 
                        }

                        if ( frame["http2.flags_tree"] && frame["http2.flags_tree"]["http2.flags.end_stream"] ) {
                            (frameData as tcpschema.IHeadersFrame).stream_end = (frame["http2.flags_tree"]["http2.flags.end_stream"] === "1") ? true : false;
                        }

                        // console.log("HTTP Headers frame discovered", (frameData as tcpschema.IHeadersFrame).headers);

                        break;  

                    case tcpschema.HTTP2FrameTypeName.data: 
                        (frameData as tcpschema.IDataFrame).byte_length = frameLength;

                        if ( frame["http2.flags_tree"] && frame["http2.flags_tree"]["http2.flags.end_stream"] ) {
                            (frameData as tcpschema.IDataFrame).stream_end = (frame["http2.flags_tree"]["http2.flags.end_stream"] === "1") ? true : false;
                        }
                        break;

                    default:
                        break;
                }

                // frameCreated and frameParsed are basically the same, just use Sent here
                const frameSent:tcpschema.IEventH2FrameCreated = {
                    stream_id: ( frame["http2.type"] !== "magic" ? parseInt( frame["http2.streamid"], 10 ) : -1),
                    payload_length: frameLength,
                    header_length: headerLength,

                    frame: frameData,
                }

                DEBUG_frameSizeTracker.push( frameLength + headerLength );
        
                connection.DEBUG_HTTPtotalSize += headerLength + frameLength;

                qlogEvent.push( frameSent );
        
                connection.qlog.events.push ( qlogEvent );
            }

            // console.log("HTTP2 FRAMESIZES", DEBUG_frameSizeTracker, DEBUG_frameSizeTracker.reduce( (prev, cur) => prev + cur, 0), frames);
        }
    }
}
