import * as qlog from '@/data/QlogSchema';
import { PacketizationLane, PacketizationRange, LightweightRange, PacketizationPreprocessor, PacketizationDirection } from './PacketizationDiagramModels';
import QlogConnection from '@/data/Connection';
import PacketizationDiagramDataHelper from './PacketizationDiagramDataHelper';

export default class PacketizationQUICPreProcessor {


    public static process( connection:QlogConnection, direction:PacketizationDirection ):Array<PacketizationLane> {
        const output = new Array<PacketizationLane>();
        PacketizationQUICPreProcessor.frameSizeErrorShown = false;

        // clients receive data, servers send it
        let QUICEventType = qlog.TransportEventType.packet_received;
        let HTTPEventType = qlog.HTTP3EventType.frame_parsed;

        // if ( connection.vantagePoint && connection.vantagePoint.type === qlog.VantagePointType.server ){
        if ( direction === PacketizationDirection.sending ) {
            QUICEventType = qlog.TransportEventType.packet_sent;
            HTTPEventType = qlog.HTTP3EventType.frame_created;
        }

        let HTTPHeadersSentEventType;
        if ( connection.vantagePoint && connection.vantagePoint.type === qlog.VantagePointType.server ) {
            HTTPHeadersSentEventType = qlog.HTTP3EventType.frame_parsed; // server receives request
        }
        else if ( connection.vantagePoint && connection.vantagePoint.type === qlog.VantagePointType.client ) {
            HTTPHeadersSentEventType = qlog.HTTP3EventType.frame_created; // client sends request
        }

        let max_packet_size_local = 65527;
        let max_packet_size_remote = 65527;

        const QUICPacketData:Array<PacketizationRange> = [];
        const QUICFrameData:Array<PacketizationRange> = [];
        const HTTPData:Array<PacketizationRange> = [];
        const StreamData:Array<PacketizationRange> = [];

        let QUICPacketIndex = 0;
        let QUICFrameIndex = 0;
        let HTTPindex = 0;

        let QUICmax = 0;

        // these two need to be the same, or there is a problem with the trace
        let DEBUG_QUICpayloadSize:number = 0;
        let DEBUG_HTTPtotalSize:number = 0;

        // these two are used to calculate "efficiency" (how much of the QUIC bytes are actually used to transport application-level data)
        let QUICtotalSize:number =  0;
        let HTTPpayloadSize:number = 0;

        const QUICPayloadRangesPerStream:Map<string, Array<LightweightRange>> = new Map<string, Array<LightweightRange>>();
        const HTTP3OutstandingFramesPerStream:Map<string, Array<qlog.IEventH3FrameCreated>> = new Map<string, Array<qlog.IEventH3FrameCreated>>();

        const HTTPStreamInfo:Map<number,any> = new Map<number,any>();

        // this is extracted into a separate function because we want to call it not just when an H3 frame event is discovered,
        // but also when we find a QUIC Data frame for a given stream
        const processHTTP3Frames = (outstandingFrames:Array<qlog.IEventH3FrameCreated>, payloadRangesForStream:Array<LightweightRange>) => {

            while ( outstandingFrames.length > 0 ) {
                const frameEvt = outstandingFrames.shift()!;

                // HTTP3 header is always the VLIE-encoded frame_type, followed by the VLIE-encoded payload length. The rest depends on the frame.
                // for now, we see all frame-specific stuff as the payload (even though that's probably not the best way to look at things... but it's consistent with HTTP2 for now)
                const framePayloadLength = parseInt(frameEvt.byte_length!, 10);
                const frameHeaderLength = PacketizationPreprocessor.VLIELength( PacketizationPreprocessor.H3FrameTypeToNumber(frameEvt.frame) ) + PacketizationPreprocessor.VLIELength( framePayloadLength );


                const totalAvailablePayloadSize = payloadRangesForStream.reduce( (prev, cur) => prev + cur.size, 0 );
                if ( totalAvailablePayloadSize < frameHeaderLength + framePayloadLength ) {
                    // console.log("HTTP3 frame wasn't fully received yet, delaying for a while", frameEvt.stream_id, totalAvailablePayloadSize, " < ", frameHeaderLength + framePayloadLength, JSON.stringify(outstandingFrames));
                    outstandingFrames.unshift( frameEvt );
                    break;
                }
                // else {
                //     console.log("HTTP3 frame was fully received, adding to the lane!", frameEvt.stream_id, totalAvailablePayloadSize, " >= ", frameHeaderLength + framePayloadLength, JSON.stringify(outstandingFrames));
                // }

                // console.log("About to extract", frameHeaderLength, frameEvt.stream_id, JSON.stringify(payloadRangesForStream) );

                const headerRanges = PacketizationPreprocessor.extractRanges( payloadRangesForStream, frameHeaderLength );

                for ( const headerRange of headerRanges ) {
                    HTTPData.push({
                        isPayload: false,

                        contentType: frameEvt.frame.frame_type,
                        index: HTTPindex, 
                        lowerLayerIndex: QUICFrameIndex - 1, 

                        start: headerRange!.start,
                        size: headerRange!.size,

                        color: ( HTTPindex % 2 === 0 ) ? "blue" : "lightblue",

                        extra: {
                            frame_length: frameHeaderLength + framePayloadLength,
                        },

                        rawPacket: frameEvt,
                    });

                    if ( frameEvt.stream_id !== undefined ) {
                        const streamID = parseInt( frameEvt.stream_id, 10 );

                        StreamData.push({
                            isPayload: true,

                            contentType: frameEvt.frame.frame_type,
                            index: HTTPindex, 
                            lowerLayerIndex: QUICFrameIndex - 1,

                            start: headerRange!.start,
                            size: headerRange!.size,

                            color: PacketizationDiagramDataHelper.StreamIDToColor( "" + streamID, "HTTP3" )[0],

                            extra: {
                                frame_length: frameHeaderLength + framePayloadLength,
                            },

                            rawPacket: frameEvt,
                        });
                    }
                }

                DEBUG_HTTPtotalSize += frameHeaderLength;

                if ( framePayloadLength > 0 ) {

                    // console.log("About to extract", framePayloadLength, frameEvt.stream_id, JSON.stringify(payloadRangesForStream) );
                
                    const payloadRanges = PacketizationPreprocessor.extractRanges( payloadRangesForStream, framePayloadLength );

                    for ( const payloadRange of payloadRanges ) {
                        HTTPData.push({
                            isPayload: true,

                            contentType: frameEvt.frame.frame_type,
                            index: HTTPindex, 
                            lowerLayerIndex: QUICFrameIndex, // belongs to the "previous" TLS record // TODO: this is probably wrong... 

                            start: payloadRange!.start,
                            size: payloadRange!.size,

                            color: ( HTTPindex % 2 === 0 ) ? "blue" : "lightblue",

                            extra: {
                                frame_length: frameHeaderLength + framePayloadLength,
                            },

                            rawPacket: frameEvt,
                        });


                        if ( frameEvt.stream_id !== undefined ) {
                            const streamID = parseInt( frameEvt.stream_id, 10 );

                            StreamData.push({
                                isPayload: true,

                                contentType: frameEvt.frame.frame_type,
                                index: HTTPindex, 
                                lowerLayerIndex: QUICFrameIndex, // belongs to the "previous" TLS record // TODO: this is probably wrong... 

                                start: payloadRange!.start,
                                size: payloadRange!.size,

                                color: PacketizationDiagramDataHelper.StreamIDToColor( "" + streamID, "HTTP3" )[0],

                                extra: {
                                    frame_length: frameHeaderLength + framePayloadLength,
                                },

                                rawPacket: frameEvt,
                            });
                        }
                    }

                    if ( frameEvt.frame && frameEvt.frame.frame_type === qlog.HTTP3FrameTypeName.data ) {
                        const streamID = parseInt( frameEvt.stream_id, 10 );
                        if ( streamID !== 0 ) {
                            if ( !HTTPStreamInfo.has(streamID) ) {
                                console.error("PacketizationDiagram: trying to increase payload size sum, but streamID not yet known! Potentially Server Push (which we don't support yet)", streamID, HTTPStreamInfo);
                            }
                            else {
                                HTTPStreamInfo.get( streamID ).total_size += framePayloadLength;
                            }
                        }
                    }

                    if ( frameEvt.frame && 
                         (frameEvt.frame.frame_type === qlog.HTTP3FrameTypeName.data ||
                          frameEvt.frame.frame_type === qlog.HTTP3FrameTypeName.headers) ) {
                            HTTPpayloadSize += framePayloadLength;
                    }

                    DEBUG_HTTPtotalSize += framePayloadLength;
                }

                ++HTTPindex;
            }
        }; // end processHTTP3frames


        for ( const eventRaw of connection.getEvents() ) {

            const event = connection.parseEvent( eventRaw );
            const rawdata = event.data;

            if ( event.name === QUICEventType ){ // packet_sent or _received

                const data = rawdata as qlog.IEventPacket;

                if ( !data.raw ) {
                    continue;
                }

                if ( !data.header || !data.header.packet_type ) {
                    console.error("PacketizationQUICPreProcessor: packet without header.packet_type set... ignoring", QUICEventType, eventRaw);
                    continue;
                }

                if ( !data.raw.length ) {
                    if ( data.raw.data !== undefined ) {
                        data.raw.length = data.raw.data.length;
                    }
                    else {
                        console.error("PacketizationQUICPreProcessor: packet without raw.length set... ignoring", QUICEventType, eventRaw);
                        continue;
                    }
                }

                const totalPacketLength = parseInt( "" + data.raw.length, 10 );
                const trailerLength = 16; // default authentication tag size is 16 bytes // TODO: support GCM8?
                let payloadLength = (data.raw.payload_length ? data.raw.payload_length : 0) - trailerLength;
                let headerLength = totalPacketLength - payloadLength;

                // lane 1 : QUIC packets

                // if not set/known explicitly: try to derive from header type
                if ( !data.raw.payload_length ) {

                    if ( data.header.packet_type === qlog.PacketType.onertt ) {
                        headerLength = Math.min(4, totalPacketLength); // TODO: actually calculate
                    }
                    else {
                        headerLength = Math.min(4, totalPacketLength); // TODO: actually calculate
                    }

                    payloadLength = totalPacketLength - headerLength - trailerLength;
                }

                // QUIC packet header
                QUICPacketData.push({
                    index: QUICPacketIndex,
                    isPayload: false,

                    start: QUICmax,
                    size: headerLength,

                    color: ( QUICPacketIndex % 2 === 0 ) ? "black" : "grey",

                    contentType: data.header.packet_type,

                    lowerLayerIndex: -1,
                    rawPacket: data,
                });

                // QUIC packet payload
                QUICPacketData.push({
                    index: QUICPacketIndex,
                    isPayload: true,

                    start: QUICmax + headerLength,
                    size: payloadLength,

                    color: ( QUICPacketIndex % 2 === 0 ) ? "black" : "grey",

                    contentType: data.header.packet_type,

                    lowerLayerIndex: -1,
                    rawPacket: data,
                });

                // QUIC tailer (authentication tag)
                QUICPacketData.push({
                    index: QUICPacketIndex,
                    isPayload: false,

                    start: QUICmax + headerLength + payloadLength,
                    size: trailerLength,

                    color: ( QUICPacketIndex % 2 === 0 ) ? "black" : "grey",

                    contentType: data.header.packet_type,

                    lowerLayerIndex: -1,
                    rawPacket: data,
                });
                
                // lane 2 : QUIC frames
                if ( data.frames ) {

                    let frameStart = QUICmax + headerLength;

                    const offset = PacketizationQUICPreProcessor.backfillFrameSizes( payloadLength, data.frames );
                    // offset is needed when we try to guesstimate the frame sizes ourselves (if frame.frame_size isn't set)
                    // if offset != 0, we've guesstimated wrong
                    // deal with this by adding a bogus frame
                    if ( offset !== 0 ) {
                        const bogus:any = {
                            header_size: offset,
                            payload_size: 0,

                            frame_type: "qvis-injected FILLER (deal with incorrectly guesstimated frame size)",

                            qvis: { sequence: { hide: true } }, // make sure these don't show up in the sequence diagram
                        };

                        data.frames.unshift( bogus as qlog.QuicFrame );
 
                        // frameStart += offset; // no longer needed now we add the bogus frame
                    }

                    for ( const rawframe of data.frames ) {

                        const frame = rawframe as any;
                        
                        if ( frame.header_size > 0 ){
                            // QUIC frame header
                            QUICFrameData.push({
                                index: (frame.frame_type.indexOf("qvis") >= 0 ? -1 : QUICFrameIndex),
                                isPayload: false,
            
                                start: frameStart,
                                size: frame.header_size,
            
                                color: (frame.frame_type.indexOf("qvis") >= 0 ? "yellow" : ( QUICFrameIndex % 2 === 0 ) ? "red" : "pink" ),
            
                                contentType: frame.frame_type,
            
                                lowerLayerIndex: QUICPacketIndex,
                                rawPacket: frame,
                            });
                        }
        
                        if ( frame.payload_size > 0 ) {
                            // QUIC frame payload
                            QUICFrameData.push({
                                index: QUICFrameIndex,
                                isPayload: true,
            
                                start: frameStart + frame.header_size,
                                size: frame.payload_size,
            
                                color: ( QUICFrameIndex % 2 === 0 ) ? "red" : "pink",
            
                                contentType: frame.frame_type,
            
                                lowerLayerIndex: QUICPacketIndex,
                                rawPacket: frame,
                            });

                            if ( frame.frame_type === qlog.QUICFrameTypeName.stream ) {

                                DEBUG_QUICpayloadSize += frame.payload_size;

                                let ranges = QUICPayloadRangesPerStream.get( "" + frame.stream_id );
                                if ( !ranges ) {
                                    ranges = new Array<LightweightRange>();
                                    QUICPayloadRangesPerStream.set( "" + frame.stream_id, ranges );
                                }

                                ranges.push( {start: frameStart + frame.header_size, size: frame.payload_size} );

                                // if H3 frames are longer than their first QUIC frame, we don't get additional events for them in many logs
                                // (proper form would be to log data_moved for them, but no-one is doing this correctly yet)
                                // so... simply re-check everytime we add more payload ranges if H3 frames we were holding back can be processed now
                                const outstandingFrames = HTTP3OutstandingFramesPerStream.get( "" + frame.stream_id );
                                if ( outstandingFrames && outstandingFrames.length > 0 ) {
                                    processHTTP3Frames( outstandingFrames, ranges );
                                }

                                if ( frame.stream_id !== undefined && frame.stream_id % 2 !== 0 ) {
                                    // unidirectional stream
                                    console.log("PacketizationPreProcessor: data seen on unidirectional stream: ", frame.stream_id, frame, data );
                                }
                            }
                        }

                        frameStart += frame.header_size + frame.payload_size;

                        if ( frame.frame_type.indexOf("qvis") < 0 ) {
                            ++QUICFrameIndex;
                        }
                    }
                }

                QUICmax += totalPacketLength;
                ++QUICPacketIndex;

                QUICtotalSize += totalPacketLength;
            } // end checking for QUIC events

            else if ( event.name === HTTPEventType ) { // frame_created or _parsed
                
                const data = rawdata as qlog.IEventH3Frame;

                if ( !data.byte_length ) {
                    console.error("H3 frame didn't have byte_length set! skipping...", data);
                    continue;
                }

                const payloadRangesForStream = QUICPayloadRangesPerStream.get( "" + data.stream_id );

                let skipProcessing = false;

                if ( !payloadRangesForStream ) {
                    if ( direction === PacketizationDirection.sending ) {
                        // when sending, frames are created before they are sent, so frame_created events happen before packet_sent and so also before QUICPayloadRangesPerStream is filled for this stream
                        // since we already had the setup with the HTTP3OutstandingFramesPerStream to deal with frame_parsed only happening once, even if the full frame hadn't been received yet
                        // we re-use this here for "too early" frame_created events as well
                        // the frames are added to outstandingFrames, but not yet processed, which is called when the packet_sent actually happens above
                        skipProcessing = true;
                    } 
                    else {
                        console.error("No payload ranges known for this stream_id, skipping...", payloadRangesForStream, data.stream_id, JSON.stringify(QUICPayloadRangesPerStream) );
                        continue;
                    }
                }

                let outstandingFrames = HTTP3OutstandingFramesPerStream.get( "" + data.stream_id );
                if ( !outstandingFrames ) {
                    outstandingFrames = new Array<qlog.IEventH3FrameCreated>();
                    HTTP3OutstandingFramesPerStream.set( "" + data.stream_id, outstandingFrames );
                }

                // H3 frames can be much longer than 1 QUIC packet, but are typically logged after the first QUIC packet they appear in (where the frame header is in)
                // so, we hold back frames until they can be fully filled in the payload ranges
                outstandingFrames.push( data );

                if ( !skipProcessing ) {
                    processHTTP3Frames( outstandingFrames, payloadRangesForStream! );
                }

            } // end checking for HTTP3 events

            
            if ( event.name === HTTPHeadersSentEventType && event.data && event.data.frame && event.data.frame.frame_type === qlog.HTTP3FrameTypeName.headers ) {

                // want to link HTTP stream IDs to resource URLs that are transported over the stream
                const streamID = parseInt( event.data.stream_id, 10 );
                if ( !HTTPStreamInfo.has(streamID) ) {
                    HTTPStreamInfo.set( streamID, { headers: event.data.frame.headers, total_size: 0 } );
                }
                else {
                    console.error("PacketizationQUICPreprocessor: HTTPStreamInfo already had an entry for this stream", streamID, HTTPStreamInfo, event.data);
                }
            }

            if ( event.name === qlog.TransportEventType.parameters_set ) {

                const data = rawdata as qlog.IEventTransportParametersSet;

                if ( data.owner && data.owner === "local" ) {
                    if ( data.max_packet_size ) {
                        max_packet_size_local = data.max_packet_size;
                    }
                }
                else if ( data.owner && data.owner === "remote" ) {
                    if ( data.max_packet_size ) {
                        max_packet_size_remote = data.max_packet_size;
                    }
                }
            }
        } // end looping over all events

        let controlStreamData = 0;
        for ( const entry of QUICPayloadRangesPerStream.entries() ) {

            // 0, 4, 8 and 1, 5, 9, etc. are normal bidirectional data streams
            // 3, 7, 11 and 2,6,10 etc. are typically unidirectional control streams and implementations don't always log frames for them (e.g., QPACK control messages)
            // so for these, it's "normal" to have leftover data, we check for that below with DEBUG_HTTPTotalSize
            const streamID = parseInt(entry[0], 10);
            if ( (streamID + 1) % 4 === 0 ) { // 3, 7, 11, ...
                for ( const range of entry[1] ) {
                    controlStreamData += range.size;
                }
            }
            else if ( (streamID + 2) % 4 === 0 ) { // 2, 6, 10, ...
                for ( const range of entry[1] ) {
                    controlStreamData += range.size;
                }
            }
            else {
                if ( entry[1].length !== 0 ) {
                    console.error( "PacketizationQUICPreprocessor: Not all QUIC payload ranges were used up!", entry[0], JSON.stringify(entry[1]), HTTP3OutstandingFramesPerStream.get("" + entry[0]) );
                }
            }
        }

        for ( const entry of HTTP3OutstandingFramesPerStream.entries() ) {
            if ( entry[1].length !== 0 ) {
                console.error( "PacketizationQUICPreprocessor: Not all HTTP3 frames found a home!", entry[0], JSON.stringify(entry[1]) );
            }
        }

        if ( DEBUG_QUICpayloadSize !== DEBUG_HTTPtotalSize ) {
            const adjustedHTTPsizeForControlStreams = DEBUG_HTTPtotalSize + controlStreamData;

            if ( DEBUG_QUICpayloadSize !== adjustedHTTPsizeForControlStreams ) {
                console.error("QUIC payload size != HTTP3 payload size", "QUIC: ", DEBUG_QUICpayloadSize, 
                                                                         "HTTP: ", DEBUG_HTTPtotalSize, 
                                                                         "HTTP leftover on control streams: ", controlStreamData, 
                                                                         "Diff : ", Math.abs(DEBUG_QUICpayloadSize - DEBUG_HTTPtotalSize) );
            }
        }
        // else {
        //     console.log("QUIC and HTTP3 payload sizes were equal! as they should be!", DEBUG_QUICpayloadSize, DEBUG_HTTPtotalSize);
        // }

        const efficiency = HTTPpayloadSize / QUICtotalSize;

        output.push( { name: "QUIC packets",         CSSClassName: "quicpacket",      ranges: QUICPacketData,     rangeToString: PacketizationQUICPreProcessor.quicRangeToString, max_size_local: max_packet_size_local, max_size_remote: max_packet_size_remote, efficiency: efficiency } );
        output.push( { name: "QUIC frames",          CSSClassName: "quicframe",       ranges: QUICFrameData,      rangeToString: PacketizationQUICPreProcessor.quicFrameRangeToString } );
        output.push( { name: "HTTP/3",               CSSClassName: "httpframe",       ranges: HTTPData,           rangeToString: (r:PacketizationRange) => { return PacketizationQUICPreProcessor.httpFrameRangeToString(r, HTTPStreamInfo); } } );
        output.push( { name: "Stream IDs",           CSSClassName: "streampacket",    ranges: StreamData,         rangeToString: (r:PacketizationRange) => { return PacketizationQUICPreProcessor.streamRangeToString(r, HTTPStreamInfo); }, heightModifier: 0.6 } );
        
        return output;
    }


    public static quicRangeToString(data:PacketizationRange) {

        let text = "QUIC ";

        text += ( data.isPayload ? "Payload #" : (data.size === 16 ? "Trailer (authentication tag) #" : "Header #")) + data.index + " : size " + data.size + "<br/>";
        text += "Packet type : " + data.contentType + ", Packet nr : " + data.rawPacket.header.packet_number + "<br/>";

        return text;
    };

    public static quicFrameRangeToString(data:PacketizationRange) {

        let text = "QUIC Frame #" + data.index + " : size " + data.size + "<br/>";
        text += "Frame type : " + data.contentType + ", stream ID: " + (data.rawPacket && data.rawPacket.stream_id !== undefined ? data.rawPacket.stream_id : "none") + "<br/>";
        if ( data.rawPacket && data.rawPacket.fin === true ) {
            text += "<b>FIN BIT SET</b>";
        }

        return text;
    };

    public static httpFrameRangeToString(data:PacketizationRange, HTTPStreamInfo:Map<number, any>) {

        let text = "H3 ";
        text += ( data.isPayload ? "Payload #" : "Header #") + data.index + " (QUIC frame index: " + data.lowerLayerIndex + ") : frame size " + data.extra.frame_length + ", partial size : " + data.size + "<br/>";
        text += "frame type: " + data.rawPacket.frame.frame_type + ", streamID: " + data.rawPacket.stream_id;

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

        let text = "H3 ";
        text += "streamID: " + data.rawPacket.stream_id;

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

    protected static frameSizeErrorShown:boolean = false;

    // payloadLength : amount of bytes to distributed across the frames
    protected static backfillFrameSizes( payloadLength:number, frames:Array<any> ):number {

        let offset = 0;

        // before draft-02, the .frame_size field wasn't specced in qlog... so try to backfill it if it isn't there, but use it if it is
        // (we assume that if one frame has frame_size set, they all have)
        if ( frames[0].frame_size ) { // normal case 

            let totalFrameLength = 0;
            for ( const frame of frames ) {
                totalFrameLength += frame.frame_size;
            }

            offset += (payloadLength - totalFrameLength);

            if ( offset !== 0 ){
                console.error("PacketizationQUICPreProcessor: frame_sizes don't fill the entire packet payload!", offset);
            }
        }
        else {

            if ( !PacketizationQUICPreProcessor.frameSizeErrorShown ) {
                console.error("PacketizationQUICPreProcessor: qlog trace does not have frame_size fields set properly. We -guesstimate- them here, so exact frame sizes are expected to be off!");
                PacketizationQUICPreProcessor.frameSizeErrorShown = true;
            }

            let simulatedPayloadLength = 0;
            const fakeFrameHeaderSize = 1; // pretend all (STREAM) frames have a header of size 1 (totally wrong, but ok for now)

            // set the new frame.frame_size property on all frames, representing the TOTAL frame size (so header + payload)
            // we don't know the actual size of the frames, so we start with the ones that we do know (STREAM) and then distribute the leftover size over the rest
            let otherFrameCount = 0;
            for ( const frame of frames ) {
                if ( frame.frame_type === qlog.QUICFrameTypeName.stream ) {
                    if ( frame.length !== undefined ) {
                        frame.frame_size = fakeFrameHeaderSize + parseInt(frame.length, 10);// TODO: consider re-transmissions/overlapping data/etc. with .offset
                        simulatedPayloadLength += frame.frame_size; 
                    }
                    else {
                        console.error("PacketizationQUICPreProcessor: stream frame with no length attribute! skipping...", frame);
                    }
                }
                if ( frame.frame_type === qlog.QUICFrameTypeName.max_streams ) {
                    // did strange things to googlevideo endpoint, so hack something that looks more plausible here
                    frame.frame_size = fakeFrameHeaderSize + 4;
                }
                else {
                    otherFrameCount++;
                }
            }

            const leftoverLength = payloadLength - simulatedPayloadLength;
            if ( leftoverLength < 0 ) {
                console.error("PacketizationQUICPreProcessor: something went wrong calculating frame sizes!", payloadLength, simulatedPayloadLength, frames);
                
                return 0;
            }

            const lengthPerOtherFrame = Math.floor(leftoverLength / otherFrameCount);
            for ( const frame of frames ) {
                if ( frame.frame_type !== qlog.QUICFrameTypeName.stream ) {
                    frame.frame_size = lengthPerOtherFrame;
                    simulatedPayloadLength += frame.frame_size;
                }
            }

            if ( payloadLength - simulatedPayloadLength < 0 ) {
                console.error("PacketizationQUICPreProcessor: payload is longer than payload! Shouldn't happen!", payloadLength, simulatedPayloadLength, lengthPerOtherFrame, frames );
            }

            offset += (payloadLength - simulatedPayloadLength); // have some rounding errors potentially from the Math.floor, so account for that here 
        }


        // header_size and payload_size aren't in qlog, but we calculate it here for ease of use below
        for ( const frame of frames ) {
            if ( frame.length ) { // STREAM and CRYPTO for now
                frame.header_size = frame.frame_size - frame.length;
                frame.payload_size = parseInt( frame.length, 10 );
            }
            else {
                frame.header_size = frame.frame_size;
                frame.payload_size = 0;
            }
        }

        return offset;
    }
}
