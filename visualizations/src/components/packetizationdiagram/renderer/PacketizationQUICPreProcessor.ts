import * as qlog from '@quictools/qlog-schema';
import { PacketizationLane, PacketizationRange, LightweightRange, PacketizationPreprocessor } from './PacketizationDiagramModels';
import QlogConnection from '@/data/Connection';
import PacketizationDiagramDataHelper from './PacketizationDiagramDataHelper';

export default class PacketizationQUICPreProcessor {


    public static process( connection:QlogConnection ):Array<PacketizationLane> {
        const output = new Array<PacketizationLane>();
        PacketizationQUICPreProcessor.frameSizeErrorShown = false;

        // clients receive data, servers send it
        let QUICEventType = qlog.TransportEventType.packet_received;
        let HTTPEventType = qlog.HTTP3EventType.frame_parsed;
        let HTTPHeadersSentEventType = qlog.HTTP3EventType.frame_created; // client sends request
        let directionText = "received";

        if ( connection.vantagePoint && connection.vantagePoint.type === qlog.VantagePointType.server ){
            QUICEventType = qlog.TransportEventType.packet_sent;
            HTTPEventType = qlog.HTTP3EventType.frame_created;
            HTTPHeadersSentEventType = qlog.HTTP3EventType.frame_parsed; // server receives request
            directionText = "sent";
        }

        const QUICPacketData:Array<PacketizationRange> = [];
        const QUICFrameData:Array<PacketizationRange> = [];
        const HTTPData:Array<PacketizationRange> = [];
        const StreamData:Array<PacketizationRange> = [];

        let QUICPacketIndex = 0;
        let QUICFrameIndex = 0;
        let HTTPindex = 0;

        let QUICmax = 0;

        let DEBUG_QUICpayloadSize:number = 0;
        let DEBUG_HTTPtotalSize:number = 0;

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

                            color: PacketizationDiagramDataHelper.streamIDToColor( "" + streamID, "HTTP3" )[0],

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

                                color: PacketizationDiagramDataHelper.streamIDToColor( "" + streamID, "HTTP3" )[0],

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

                    DEBUG_HTTPtotalSize += framePayloadLength;
                }

                ++HTTPindex;
            }
        }; // end processHTTP3frames


        for ( const eventRaw of connection.getEvents() ) {

            const event = connection.parseEvent( eventRaw );
            const data = event.data;

            if ( event.name === QUICEventType ){ // packet_sent or _received

                if ( !data.header.packet_size ) {
                    console.error("PacketizationQUICPreProcessor: packet without header.packet_size set... ignoring", QUICEventType, eventRaw);
                    continue;
                }

                const totalPacketLength = data.header.packet_size;
                let payloadLength = data.header.payload_length;
                let headerLength = totalPacketLength - payloadLength;

                // lane 1 : QUIC packets

                // if not set/known explicitly: try to derive from header type
                if ( !data.header.payload_length ) {

                    if ( data.packet_type === qlog.PacketType.onertt ) {
                        headerLength = Math.min(4, totalPacketLength); // TODO: actually calculate
                    }
                    else {
                        headerLength = Math.min(4, totalPacketLength); // TODO: actually calculate
                    }

                    payloadLength = totalPacketLength - headerLength;
                }

                // QUIC packet header
                QUICPacketData.push({
                    index: QUICPacketIndex,
                    isPayload: false,

                    start: QUICmax,
                    size: headerLength,

                    color: ( QUICPacketIndex % 2 === 0 ) ? "black" : "grey",

                    contentType: data.packet_type,

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

                    contentType: data.packet_type,

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
                        const bogus = {
                            header_size: offset,
                            payload_size: 0,

                            frame_type: "qvis-injected FILLER (deal with incorrectly guesstimated frame size)",
                        };

                        data.frames.unshift( bogus );
 
                        // frameStart += offset; // no longer needed now we add the bogus frame
                    }

                    for ( const frame of data.frames ) {
                        
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
            } // end checking for QUIC events

            else if ( event.name === HTTPEventType ) { // frame_created or _parsed
                
                if ( !data.byte_length ) {
                    console.error("H3 frame didn't have byte_length set! skipping...", data);
                    continue;
                }

                const payloadRangesForStream = QUICPayloadRangesPerStream.get( "" + data.stream_id );

                if ( !payloadRangesForStream ) {
                    console.error("No payload ranges known for this stream_id, skipping...", payloadRangesForStream, data.stream_id, QUICPayloadRangesPerStream);
                    continue;
                }

                let outstandingFrames = HTTP3OutstandingFramesPerStream.get( "" + data.stream_id );
                if ( !outstandingFrames ) {
                    outstandingFrames = new Array<qlog.IEventH3FrameCreated>();
                    HTTP3OutstandingFramesPerStream.set( "" + data.stream_id, outstandingFrames );
                }

                // H3 frames can be much longer than 1 QUIC packet, but are typically logged after the first QUIC packet they appear in (where the frame header is in)
                // so, we hold back frames until they can be fully filled in the payload ranges
                outstandingFrames.push( data );

                processHTTP3Frames( outstandingFrames, payloadRangesForStream );

            } // end checking for HTTP3 events

            
            if ( event.name === HTTPHeadersSentEventType && event.data.frame.frame_type === qlog.HTTP3FrameTypeName.headers ) {
                // want to link HTTP stream IDs to resource URLs that are transported over the stream
                const streamID = parseInt( event.data.stream_id, 10 );
                if ( !HTTPStreamInfo.has(streamID) ) {
                    HTTPStreamInfo.set( streamID, { headers: event.data.frame.headers, total_size: 0 } );
                }
                else {
                    console.error("PacketizationQUICPreprocessor: HTTPStreamInfo already had an entry for this stream", streamID, HTTPStreamInfo, event.data);
                }
            }

        } // end looping over all events

        let controlStreamData = 0;
        for ( const entry of QUICPayloadRangesPerStream.entries() ) {

            // 3, 7, 11 etc. are typically control streams opened by the server. clients don't always log frames for them (e.g., QPACK control messages)
            // so for the, it's "normal" to have leftover data, we check for that below with DEBUG_HTTPTotalSize
            const streamID = parseInt(entry[0], 10);
            if ( (streamID + 1) % 4 === 0 ) { 
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


        output.push( { name: "QUIC packets",         CSSClassName: "quicpacket",      ranges: QUICPacketData,     rangeToString: PacketizationQUICPreProcessor.quicRangeToString } );
        output.push( { name: "QUIC frames",          CSSClassName: "quicframe",       ranges: QUICFrameData,      rangeToString: PacketizationQUICPreProcessor.quicFrameRangeToString } );
        output.push( { name: "HTTP/3",               CSSClassName: "httpframe",       ranges: HTTPData,           rangeToString: (r:PacketizationRange) => { return PacketizationQUICPreProcessor.httpFrameRangeToString(r, HTTPStreamInfo); } } );
        output.push( { name: "Stream IDs",           CSSClassName: "streampacket",    ranges: StreamData,         rangeToString: (r:PacketizationRange) => { return PacketizationQUICPreProcessor.streamRangeToString(r, HTTPStreamInfo); }, heightModifier: 0.6 } );
        
        return output;
    }


    public static quicRangeToString(data:PacketizationRange) {

        let text = "QUIC ";
        text += ( data.isPayload ? "Payload #" : "Header #") + data.index + " : size " + data.size + "<br/>";
        text += "Packet type : " + data.contentType + ", Packet nr : " + data.rawPacket.header.packet_number + "<br/>";

        return text;
    };

    public static quicFrameRangeToString(data:PacketizationRange) {

        let text = "QUIC Frame #" + data.index + " : size " + data.size + "<br/>";
        text += "Frame type : " + data.contentType + ", stream ID: " + (data.rawPacket && data.rawPacket.stream_id ? data.rawPacket.stream_id : "none") + "<br/>";

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
                    if ( frame.length ) {
                        frame.frame_size = fakeFrameHeaderSize + frame.length;// TODO: consider re-transmissions/overlapping data/etc. with .offset
                        simulatedPayloadLength += frame.frame_size; 
                    }
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
                frame.payload_size = frame.length;
            }
            else {
                frame.header_size = frame.frame_size;
                frame.payload_size = 0;
            }
        }

        return offset;
    }
}
