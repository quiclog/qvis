import * as tcpqlog from "@/components/filemanager/pcapconverter/qlog_tcp_tls_h2";
import * as qlog from '@/data/QlogSchema';
import { PacketizationLane, PacketizationRange, LightweightRange, PacketizationPreprocessor, PacketizationDirection } from './PacketizationDiagramModels';
import QlogConnection from '@/data/Connection';
import PacketizationDiagramDataHelper from './PacketizationDiagramDataHelper';

export default class PacketizationTCPPreProcessor {


    public static process( tcpConnection:QlogConnection, direction:PacketizationDirection ):Array<PacketizationLane> {
        const output = new Array<PacketizationLane>();


        // clients receive data, servers send it
        let TCPEventType = qlog.TransportEventType.packet_received;
        let TLSEventType = tcpqlog.TLSEventType.record_parsed;
        let HTTPEventType = tcpqlog.HTTP2EventType.frame_parsed;
        let directionText = "received";

        // if ( tcpConnection.vantagePoint && tcpConnection.vantagePoint.type === qlog.VantagePointType.server ){
        if ( direction === PacketizationDirection.sending ){
            TCPEventType = qlog.TransportEventType.packet_sent;
            TLSEventType = tcpqlog.TLSEventType.record_created;
            HTTPEventType = tcpqlog.HTTP2EventType.frame_created;
            directionText = "sent";
        }

        let HTTPHeadersSentEventType; // default value
        if ( tcpConnection.vantagePoint && tcpConnection.vantagePoint.type === qlog.VantagePointType.server ) {
            HTTPHeadersSentEventType = tcpqlog.HTTP2EventType.frame_parsed // server receives request
        }
        else if ( tcpConnection.vantagePoint && tcpConnection.vantagePoint.type === qlog.VantagePointType.client ) {
            HTTPHeadersSentEventType = tcpqlog.HTTP2EventType.frame_created; // client sends request
        }

        const TCPData:Array<PacketizationRange> = [];
        const TLSData:Array<PacketizationRange> = [];
        const HTTPData:Array<PacketizationRange> = [];
        const StreamData:Array<PacketizationRange> = [];

        let TCPindex = 0;
        let TLSindex = 0;
        let HTTPindex = 0;

        let TCPmax = 0;
        // let TLSmax = 0; 
        // let HTTPmax = 0;

        let DEBUG_TLSpayloadSize:number = 0;
        let DEBUG_HTTPtotalSize:number = 0;

        const TCPPayloadRanges:Array<LightweightRange> = new Array<LightweightRange>();
        const TLSPayloadRanges:Array<LightweightRange> = new Array<LightweightRange>();

        const HTTPStreamInfo:Map<number,any> = new Map<number,any>();

        for ( const eventRaw of tcpConnection.getEvents() ) {

            const event = tcpConnection.parseEvent( eventRaw );
            const data = event.data;

            if ( event.name === TCPEventType ){ // packet_sent or _received, the ones we want to plot

                if ( data.header.payload_length === 0 ){
                    // ack, not showing these for now
                    continue;
                }

                const length = data.header.header_length + data.header.payload_length;

                // TCP packet header
                TCPData.push({
                    index: TCPindex,
                    isPayload: false,

                    start: TCPmax,
                    size: data.header.header_length,

                    color: ( TCPindex % 2 === 0 ) ? "black" : "grey",

                    lowerLayerIndex: -1,
                    rawPacket: data,
                });

                // TCP packet payload
                TCPData.push({
                    index: TCPindex,
                    isPayload: true,

                    start: TCPmax + data.header.header_length,
                    size: data.header.payload_length,

                    color: ( TCPindex % 2 === 0 ) ? "black" : "grey",

                    lowerLayerIndex: -1,
                    rawPacket: data,
                });

                TCPPayloadRanges.push( {start: TCPmax + data.header.header_length, size: data.header.payload_length} );

                TCPmax += length;
                ++TCPindex;
            }
            else if ( event.name === TLSEventType ) {

                const payloadLength = Math.max(0, data.header.payload_length);
                const recordLength = data.header.header_length + payloadLength + data.header.trailer_length;

                // console.log("Matching TLS records with TCP payload ranges", recordLength, JSON.stringify(TCPPayloadRanges));

                // each TLS record is x bytes header (typically 5 bytes), then payload, then MAC or encryption nonce (typically 16 bytes)
                const headerRanges  = PacketizationPreprocessor.extractRanges( TCPPayloadRanges, data.header.header_length );
                for ( const headerRange of headerRanges ) {
                    TLSData.push({
                        isPayload: false,

                        contentType: data.header.content_type,
                        index: TLSindex, 
                        lowerLayerIndex: TCPindex - 1, // belongs to the "previous" TCP packet
                        
                        start: headerRange!.start,
                        size: headerRange.size, 

                        color: ( TLSindex % 2 === 0 ) ? "red" : "pink",

                        extra: {
                            DEBUG_wiresharkFrameNumber: data.header.DEBUG_wiresharkFrameNumber,
                            record_length: recordLength,
                            payload_length: payloadLength,
                        },

                        rawPacket: data,
                    });
                }
                
                const payloadRanges = PacketizationPreprocessor.extractRanges( TCPPayloadRanges, payloadLength ); 
                for ( const payloadRange of payloadRanges ) {
                    TLSData.push({
                        isPayload: true,

                        contentType: data.header.content_type,
                        index: TLSindex, 
                        lowerLayerIndex: TCPindex - 1, // belongs to the "previous" TCP packet
                        
                        start: payloadRange!.start,
                        size: payloadRange.size, 

                        color: ( TLSindex % 2 === 0 ) ? "red" : "pink",

                        extra: {
                            DEBUG_wiresharkFrameNumber: data.header.DEBUG_wiresharkFrameNumber,
                            record_length: recordLength,
                            payload_length: payloadLength,
                        },

                        rawPacket: data,
                    });

                    if ( data.header.content_type === "application" ){
                        TLSPayloadRanges.push( {start: payloadRange!.start, size: payloadRange!.size} );
                        DEBUG_TLSpayloadSize += payloadRange!.size;
                    }
                }

                if ( data.header.trailer_length !== 0 ){
                    const trailerRanges = PacketizationPreprocessor.extractRanges( TCPPayloadRanges, data.header.trailer_length );

                    for ( const trailerRange of trailerRanges ) {
                        TLSData.push({
                            isPayload: false,

                            contentType: data.header.content_type,
                            index: TLSindex, 
                            lowerLayerIndex: TCPindex - 1, // belongs to the "previous" TCP packet
                            
                            start: trailerRange!.start,
                            size: trailerRange.size, 

                            color: ( TLSindex % 2 === 0 ) ? "red" : "pink",

                            extra: {
                                DEBUG_wiresharkFrameNumber: data.header.DEBUG_wiresharkFrameNumber,
                                record_length: recordLength,
                                payload_length: payloadLength,
                            },
    
                            rawPacket: data,
                        });
                    }
                }

                ++TLSindex;
            }
            else if ( event.name === HTTPEventType ) {

                if ( data.header_length > 0 ) { // MAGIC from client doesn't have a header
                    const headerRanges = PacketizationPreprocessor.extractRanges( TLSPayloadRanges, data.header_length );
                    for ( const headerRange of headerRanges ) {
                        HTTPData.push({
                            isPayload: false,

                            contentType: data.content_type,
                            index: HTTPindex, 
                            lowerLayerIndex: TLSindex - 1, // belongs to the "previous" TLS record // TODO: this is probably wrong... 

                            start: headerRange!.start,
                            size: headerRange!.size,

                            color: ( HTTPindex % 2 === 0 ) ? "blue" : "lightblue",

                            extra: {
                                frame_length: data.header_length + data.payload_length,
                            },

                            rawPacket: data,
                        });

                        if ( data.stream_id !== undefined ) {
                            const streamID = parseInt( data.stream_id, 10 );

                            StreamData.push({
                                isPayload: true,

                                contentType: data.content_type,
                                index: HTTPindex, 
                                lowerLayerIndex: TLSindex - 1, // belongs to the "previous" TLS record // TODO: this is probably wrong... 

                                start: headerRange!.start,
                                size: headerRange!.size,

                                color: PacketizationDiagramDataHelper.StreamIDToColor( "" + streamID, "HTTP2" )[0],

                                extra: {
                                    frame_length: data.header_length + data.payload_length,
                                },

                                rawPacket: data,
                            });
                        }
                    }

                    DEBUG_HTTPtotalSize += data.header_length;
                }

                // some frames, like SETTINGS, don't necessarily have a payload
                if ( data.payload_length > 0 ) {
                    const payloadRanges = PacketizationPreprocessor.extractRanges( TLSPayloadRanges, data.payload_length );

                    for ( const payloadRange of payloadRanges ) {
                        HTTPData.push({
                            isPayload: true,

                            contentType: data.content_type,
                            index: HTTPindex, 
                            lowerLayerIndex: TLSindex - 1, // belongs to the "previous" TLS record // TODO: this is probably wrong... 

                            start: payloadRange!.start,
                            size: payloadRange!.size,

                            color: ( HTTPindex % 2 === 0 ) ? "blue" : "lightblue",

                            extra: {
                                frame_length: data.header_length + data.payload_length,
                            },

                            rawPacket: data,
                        });


                        if ( data.stream_id !== undefined ) {
                            const streamID = parseInt( data.stream_id, 10 );

                            StreamData.push({
                                isPayload: true,

                                contentType: data.content_type,
                                index: HTTPindex, 
                                lowerLayerIndex: TLSindex - 1, // belongs to the "previous" TLS record // TODO: this is probably wrong... 

                                start: payloadRange!.start,
                                size: payloadRange!.size,

                                color: PacketizationDiagramDataHelper.StreamIDToColor( "" + streamID, "HTTP2" )[0],

                                extra: {
                                    frame_length: data.header_length + data.payload_length,
                                },

                                rawPacket: data,
                            });
                        }
                    }

                    if ( event.data.frame && event.data.frame.frame_type === tcpqlog.HTTP2FrameTypeName.data ) {
                        const streamID = parseInt( event.data.stream_id, 10 );
                        if ( streamID !== 0 ) {
                            if ( !HTTPStreamInfo.has(streamID) ) {
                                console.error("PacketizationTCPPreprocessor: trying to increase payload size sum, but streamID not yet known! Potentially Server Push (which we don't support yet)", streamID, HTTPStreamInfo);
                            }
                            else {
                                HTTPStreamInfo.get( streamID ).total_size += data.payload_length;
                            }
                        }
                    }

                    DEBUG_HTTPtotalSize += data.payload_length;
                }
                else {
                    if ( data.frame.frame_type !== tcpqlog.HTTP2FrameTypeName.settings ) { // for settings, we know the server sometimes doesn't send anything
                        console.warn("PacketizationTCPPreprocessor: Found HTTP frame without payload length... potential error?", data);
                    }
                }

                ++HTTPindex;
            }
            
            if ( event.name === HTTPHeadersSentEventType && event.data.frame.frame_type === tcpqlog.HTTP2FrameTypeName.headers ) {
                // want to link HTTP stream IDs to resource URLs that are transported over the stream
                const streamID = parseInt( event.data.stream_id, 10 );
                if ( !HTTPStreamInfo.has(streamID) ) {
                    HTTPStreamInfo.set( streamID, { headers: event.data.frame.headers, total_size: 0 } );
                }
                else {
                    console.error("PacketizationTCPPreprocessor: HTTPStreamInfo already had an entry for this stream", streamID, HTTPStreamInfo, event.data);
                }
            }
        }

        if ( TCPPayloadRanges.length !== 0 || TLSPayloadRanges.length !== 0 ){
            console.error( "PacketizationTCPPreprocessor: Not all payload ranges were used up!", TCPPayloadRanges, TLSPayloadRanges);
        }

        if ( DEBUG_TLSpayloadSize !== DEBUG_HTTPtotalSize ) {
            console.error("TLS payload size != HTTP payload size", "TLS: ", DEBUG_TLSpayloadSize, "HTTP: ", DEBUG_HTTPtotalSize, "Diff : ", Math.abs(DEBUG_TLSpayloadSize - DEBUG_HTTPtotalSize) );
        }

        output.push( { name: "TCP",         CSSClassName: "tcppacket",      ranges: TCPData,     rangeToString: PacketizationTCPPreProcessor.tcpRangeToString } );
        output.push( { name: "TLS",         CSSClassName: "tlspacket",      ranges: TLSData,     rangeToString: PacketizationTCPPreProcessor.tlsRangeToString } );
        output.push( { name: "HTTP/2",      CSSClassName: "httppacket",     ranges: HTTPData,    rangeToString: (r:PacketizationRange) => { return PacketizationTCPPreProcessor.httpRangeToString(r, HTTPStreamInfo); } } );
        output.push( { name: "Stream IDs",  CSSClassName: "streampacket",   ranges: StreamData,  rangeToString: (r:PacketizationRange) => { return PacketizationTCPPreProcessor.streamRangeToString(r, HTTPStreamInfo); }, heightModifier: 0.6 } );
        
        return output;
    }

    public static tcpRangeToString(data:PacketizationRange) {

        let text = "TCP ";
        text += ( data.isPayload ? "Payload #" : "Header #") + data.index + " : packet size " + data.size + "<br/>";
        // text += "[" + data.offset + ", " + (data.offset + data.length - 1) + "] (size: " + data.length + ")";

        return text;
    };

    public static tlsRangeToString(data:PacketizationRange) {

        let text = "TLS ";
        text += ( data.isPayload ? "Payload #" :  (data.size > 5 ? "Trailer (MAC/auth tag/padding/content type) " : "Header #")) + data.index;
        text += " (TCP index: " + data.lowerLayerIndex + ") : record size " + data.extra.record_length + ", partial size " + data.size + "<br/>";

        if ( data.extra.DEBUG_wiresharkFrameNumber ) {
            text += "Wireshark frame number (DEBUG): " + data.extra.DEBUG_wiresharkFrameNumber + "<br/>";
        }

        // text += "Total record length: " + data.record_length + ", Total payload length: " + data.payload_length + "<br/>";
        text += "content type: " + data.contentType;

        return text;
    };

    public static httpRangeToString(data:PacketizationRange, HTTPStreamInfo:Map<number, any>) {

        let text = "H2 ";
        text += ( data.isPayload ? "Payload #" : "Header #") + " (TLS index: " + data.lowerLayerIndex + ") : frame size " + data.rawPacket.payload_length + ", partial size : " + data.size + "<br/>";
        text += "frame type: " + data.rawPacket.frame.frame_type + ", streamID: " + data.rawPacket.stream_id;

        if ( data.rawPacket.frame.stream_end ) {
            text += "<br/>";
            text += "<b>STREAM END BIT SET</b>";
        }

        const streamInfo = HTTPStreamInfo.get( parseInt(data.rawPacket.stream_id, 10) );
        if ( streamInfo ) {
            text += "<br/>";
            let method = "";
            let path = "";
            for ( const header of streamInfo.headers ) {
                if ( header.name === ":method" ) {
                    method = header.value;
                }
                else if ( header.name === ":path" ) {
                    path = header.value;
                }
            }
            text += "" + method + ": " + path + "<br/>";
            text += "total resource size: " + streamInfo.total_size + "<br/>";
        }

        return text;
    };

    public static streamRangeToString(data:PacketizationRange, HTTPStreamInfo:Map<number, any>) {

        let text = "H2 ";
        text += "streamID: " + data.rawPacket.stream_id;

        if ( data.rawPacket.frame.stream_end ) {
            text += "<br/>";
            text += "<b>STREAM END BIT SET</b>";
        }

        const streamInfo = HTTPStreamInfo.get( parseInt(data.rawPacket.stream_id, 10) );
        if ( streamInfo ) {
            text += "<br/>";
            let method = "";
            let path = "";
            for ( const header of streamInfo.headers ) {
                if ( header.name === ":method" ) {
                    method = header.value;
                }
                else if ( header.name === ":path" ) {
                    path = header.value;
                }
            }
            text += "" + method + ": " + path + "<br/>";
            text += "total resource size: " + streamInfo.total_size + "<br/>";
        }

        return text;
    };
}
