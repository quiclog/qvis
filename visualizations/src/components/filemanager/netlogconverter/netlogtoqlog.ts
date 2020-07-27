import * as qlogschema from '@quictools/qlog-schema';
import * as netlogschema from './netlog';
import { IEventTransportParametersSet } from '@quictools/qlog-schema';

function invertMap(map: Map<string, number>): Map<number, string> {
    const result: Map<number, string> = new Map<number, string>();

    Object.entries(map).forEach((entry) => {
        const value: number = entry[1] as number;
        result.set(value, entry[0]);
    });

    return result;
};

export default class NetlogToQlog {

    public static convert(netlogJSON: netlogschema.Netlog): qlogschema.IQLog {
        console.log("NetlogToQlog: converting file with " + netlogJSON.events.length + " events");

        const constants: netlogschema.Constants = netlogJSON.constants;
        const events: Array<netlogschema.Event> = netlogJSON.events;

        const event_types: Map<number, string> = invertMap(constants.logEventTypes);
        const source_types: Map<number, string> = invertMap(constants.logSourceType);
        const phases: Map<number, string> = invertMap(constants.logEventPhase);

        let start_time: number | undefined = undefined;
        let session_id: number | undefined = undefined;

        let packetSent: number = 0;
        let frameSent: number = 0;
        let packetRx: number = 0;
        let frameRx: number = 0;

        const qlogEvents: Array<Array<qlogschema.EventField>> = new Array<Array<qlogschema.EventField>>();
        const txQUICFrames: Array<qlogschema.QuicFrame> = new Array<qlogschema.QuicFrame>();
        const rxQUICFrames: Array<qlogschema.QuicFrame> = new Array<qlogschema.QuicFrame>();

        for (const event of events) {
            // source of event
            const source_type: string | undefined = source_types.get(event.source.type);
            if (source_type === undefined) {
                continue;
            }

            // Right now only support events part of a QUIC session
            if (source_type !== 'QUIC_SESSION') {
                continue;
            }

            // source id of event
            const source_id: number = event.source.id;
            if (session_id === undefined) {
                session_id = source_id;
            } else {
                if (source_id !== session_id) {
                    continue;
                }
            }

            // event_type of event
            const event_type: string | undefined = event_types.get(event.type);
            if (event_type === undefined) {
                continue;
            }

            // phase of event
            const phase: string | undefined = phases.get(event.phase);
            if (phase === undefined) {
                continue;
            }

            // event time in ms
            let time: number = +event.time;
            if (start_time === undefined) {
                start_time = time;
                time = 0;
            } else {
                time = time - start_time;
            }

            // custom params
            const params: any = event.params;

            // Create a new qlog event with relative time
            const qlogEvent: Array<qlogschema.EventField> = new Array<qlogschema.EventField>();
            qlogEvent.push(time);

            switch (event_type) {
                case 'QUIC_SESSION': {
                    if (phase === "PHASE_BEGIN") {
                        const event_params: netlogschema.QUIC_SESSION = params;
                    }
                    break;
                }

                case 'QUIC_SESSION_TRANSPORT_PARAMETERS_SENT': {
                    const event_params: Array<string> = (params as netlogschema.QUIC_SESSION_TRANSPORT_PARAMETERS).quic_transport_parameters.split(" ").slice(1);
                    const data: any = { owner: 'local' };
                    for (let i = 0; i < event_params.length; i += 2) {
                        const key: string = event_params[i];
                        const value: string = event_params[i + 1];
                        data[key] = value;
                    }

                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.parameters_set);
                    qlogEvent.push(data as qlogschema.IEventTransportParametersSet);
                    qlogEvents.push(qlogEvent);
                    break;
                }

                case 'QUIC_SESSION_CRYPTO_FRAME_SENT': {
                    frameSent++;
                    const event_params: netlogschema.QUIC_SESSION_CRYPTO_FRAME = params;
                    const frame: qlogschema.ICryptoFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.crypto,
                        offset: event_params.offset.toString(),
                        length: event_params.data_length.toString(),
                    }
                    txQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_PADDING_FRAME_SENT': {
                    frameSent++;
                    const event_params: netlogschema.QUIC_SESSION_PADDING_FRAME = params;
                    const frame: qlogschema.IPaddingFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.padding,
                    }
                    txQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_PING_FRAME_SENT': {
                    frameSent++;
                    const frame: qlogschema.IPingFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.ping,
                    }
                    txQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_STREAM_FRAME_SENT': {
                    frameSent++;
                    const event_params: netlogschema.QUIC_SESSION_STREAM_FRAME = params;
                    const frame: qlogschema.IStreamFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.stream,
                        stream_id: event_params.stream_id.toString(),
                        offset: event_params.offset.toString(),
                        length: event_params.length.toString(),
                        fin: event_params.fin,
                    }
                    txQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_ACK_FRAME_SENT': {
                    frameSent++;
                    const event_params: netlogschema.QUIC_SESSION_ACK_FRAME = params;
                    // TODO: Populate ack frame
                    const frame: qlogschema.IAckFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.ack,
                    }
                    txQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_CONNECTION_CLOSE_FRAME_SENT': {
                    frameSent++;
                    const event_params: netlogschema.QUIC_SESSION_CONNECTION_CLOSE_FRAME_SENT = params;
                    const frame: qlogschema.IConnectionCloseFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.connection_close,
                        error_space: qlogschema.ErrorSpace.transport_error,
                        error_code: event_params.quic_error,
                        raw_error_code: event_params.quic_error,
                        reason: event_params.details,
                    };
                    txQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_PACKET_SENT': {
                    packetSent++;
                    const event_params: netlogschema.QUIC_SESSION_PACKET_SENT = params;
                    const packet_type: qlogschema.PacketType = ((): qlogschema.PacketType => {
                        switch (event_params.encryption_level) {
                            case netlogschema.PacketType.handshake:
                                return qlogschema.PacketType.handshake;
                            case netlogschema.PacketType.initial:
                                return qlogschema.PacketType.initial;
                            case netlogschema.PacketType.onertt:
                                return qlogschema.PacketType.onertt;
                            default:
                                throw new Error(`could not process packet type: ${event_params.encryption_level}`);
                        }
                    })();
                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.packet_sent);

                    const frames: Array<qlogschema.QuicFrame> = new Array<qlogschema.QuicFrame>();
                    txQUICFrames.forEach((frame) => frames.push(Object.assign({}, frame)));
                    qlogEvent.push({
                        packet_type,
                        header: {
                            packet_number: event_params.packet_number.toString(),
                            packet_size: event_params.size,
                        },
                        frames,
                        is_coalesced: false,
                    } as qlogschema.IEventPacket);
                    qlogEvents.push(qlogEvent);

                    // Reset batch QUIC frames
                    txQUICFrames.length = 0;
                    break;
                }

                case 'QUIC_SESSION_COALESCED_PACKET_SENT': {
                    const event_params: netlogschema.QUIC_SESSION_COALESCED_PACKET_SENT = params;
                    const infoArr: Array<string> = event_params.info.split(' ');
                    const infoData: any = {};
                    for (let i = 0; i < infoArr.length; i += 2) {
                        infoArr[i] = infoArr[i].replace(':', '');
                        infoArr[i + 1] = infoArr[i + 1].replace('/[\{\}]/g', '');
                        infoData[infoArr[i]] = infoArr[i + 1];
                    }

                    const coalescedPacket: netlogschema.QUIC_SESSION_COALESCED_PACKET = infoData;
                    const numPackets: number = coalescedPacket.packets.split(",").length;
                    packetSent += numPackets;
                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.packet_sent);
                    // qlogEvent.push({
                    //     packet_type: qlogschema.PacketType.,
                    //     header: {
                    //         packet_number: coalescedPacket.packet_number,
                    //         packet_size: coalescedPacket.total_length,
                    //     },
                    //     frames: txQUICFrames,
                    //     is_coalesced: true,
                    // } as qlogschema.IEventPacket);
                    break;
                }

                case 'QUIC_SESSION_PACKET_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_PACKET_RECEIVED = params;
                    break;
                }

                case 'QUIC_SESSION_UNAUTHENTICATED_PACKET_HEADER_RECEIVED': {
                    packetRx++;
                    const event_params: netlogschema.QUIC_SESSION_UNAUTHENTICATED_PACKET_HEADER_RECEIVED = params;
                    const packet_type: qlogschema.PacketType = ((): qlogschema.PacketType => {
                        switch (event_params.long_header_type) {
                            case netlogschema.LONG_HEADER_TYPE.handshake:
                                return qlogschema.PacketType.handshake;
                            case netlogschema.LONG_HEADER_TYPE.initial:
                                return qlogschema.PacketType.initial;
                            default:
                                return qlogschema.PacketType.onertt;
                        }
                    })();

                    console.log(`rxQUICFrames length: ${rxQUICFrames.length}`);

                    const frames: Array<qlogschema.QuicFrame> = new Array<qlogschema.QuicFrame>();
                    rxQUICFrames.forEach((frame) => frames.push(Object.assign({}, frame)));

                    const packet: qlogschema.IEventPacket = {
                        packet_type,
                        header: {
                            packet_number: event_params.packet_number.toString(),
                        },
                        frames,
                        is_coalesced: false,
                    };

                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.packet_received);
                    qlogEvent.push(packet);
                    qlogEvents.push(qlogEvent);

                    rxQUICFrames.length = 0;
                    break;
                }

                case 'QUIC_SESSION_TRANSPORT_PARAMETERS_RECEIVED': {
                    const event_params: Array<string> = (params as netlogschema.QUIC_SESSION_TRANSPORT_PARAMETERS).quic_transport_parameters.split(" ").slice(1);
                    const data: any = { owner: 'remote' };
                    for (let i = 0; i < event_params.length; i += 2) {
                        const key: string = event_params[i];
                        const value: string = event_params[i + 1];
                        data[key] = value;
                    }

                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.parameters_set);
                    qlogEvent.push(data as qlogschema.IEventTransportParametersSet);
                    qlogEvents.push(qlogEvent);
                    break;
                }

                case 'QUIC_SESSION_HANDSHAKE_DONE_FRAME_RECEIVED': {
                    frameRx++;
                    // No params
                    break;
                }

                case 'QUIC_SESSION_ACK_FRAME_RECEIVED': {
                    frameRx++;
                    const event_params: netlogschema.QUIC_SESSION_ACK_FRAME = params;
                    // TODO: Populate ack frame
                    const frame: qlogschema.IAckFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.ack,
                    }
                    rxQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_CRYPTO_FRAME_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_CRYPTO_FRAME = params;
                    const frame: qlogschema.ICryptoFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.crypto,
                        offset: event_params.offset.toString(),
                        length: event_params.data_length.toString(),
                    }
                    rxQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_PADDING_FRAME_RECEIVED': {
                    frameRx++;
                    const event_params: netlogschema.QUIC_SESSION_PADDING_FRAME = params;
                    const frame: qlogschema.IPaddingFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.padding,
                    }
                    rxQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_STREAM_FRAME_RECEIVED': {
                    frameRx++;
                    const event_params: netlogschema.QUIC_SESSION_STREAM_FRAME = params;
                    const frame: qlogschema.IStreamFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.stream,
                        stream_id: event_params.stream_id.toString(),
                        offset: event_params.offset.toString(),
                        length: event_params.length.toString(),
                        fin: event_params.fin,
                    }
                    rxQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_CLOSED': {
                    const event_params: netlogschema.QUIC_SESSION_CLOSED = params;
                    qlogEvent.push(qlogschema.EventCategory.transport);
                    break;
                }

                case 'QUIC_SESSION_CLOSE_ON_ERROR': {
                    break;
                }

                case 'QUIC_SESSION_BUFFERED_UNDECRYPTABLE_PACKET': {
                    break;
                }

                case 'QUIC_SESSION_ATTEMPTING_TO_PROCESS_UNDECRYPTABLE_PACKET': {
                    break;
                }

                case 'QUIC_SESSION_PACKET_AUTHENTICATED': {
                    break;
                }

                case 'QUIC_SESSION_VERSION_NEGOTIATED': {
                    break;
                }

                case 'QUIC_SESSION_PACKET_AUTHENTICATED': {
                    break;
                }

                case 'QUIC_SESSION_STREAM_FRAME_COALESCED': {
                    break;
                }

                case 'QUIC_SESSION_CERTIFICATE_VERIFIED': {
                    break;
                }

                case 'HTTP3_LOCAL_CONTROL_STREAM_CREATED': {
                    break;
                }

                case 'HTTP3_LOCAL_QPACK_DECODER_STREAM_CREATED': {
                    break;
                }

                case 'HTTP3_LOCAL_QPACK_ENCODER_STREAM_CREATED': {
                    break;
                }

                case 'HTTP3_PEER_CONTROL_STREAM_CREATED': {
                    break;
                }

                case 'HTTP3_PEER_QPACK_ENCODER_STREAM_CREATED': {
                    break;
                }

                case 'HTTP3_PEER_QPACK_DECODER_STREAM_CREATED': {
                    break;
                }

                case 'HTTP3_SETTINGS_SENT': {
                    break;
                }

                case 'HTTP3_MAX_PUSH_ID_SENT': {
                    break;
                }

                case 'HTTP3_HEADERS_SENT': {
                    break;
                }

                case 'HTTP3_DATA_SENT': {
                    break;
                }

                case 'HTTP3_PRIORITY_UPDATE_SENT': {
                    break;
                }

                case 'HTTP3_SETTINGS_RECEIVED': {
                    break;
                }

                case 'HTTP3_HEADERS_RECEIVED': {
                    break;
                }

                case 'HTTP3_DATA_FRAME_RECEIVED': {
                    break;
                }

                case 'HTTP3_UNKNOWN_FRAME_RECEIVED': {
                    break;
                }

                case 'HTTP3_HEADERS_DECODED': {
                    break;
                }

                default: {
                    console.log(event_type);
                    break;
                }
            }
        }
        console.log(`packets sent: ${packetSent}, frames sent: ${frameSent}`);
        console.log(`packets rxed: ${packetRx}, frames rxed: ${frameRx}`);

        if (start_time === undefined) {
            throw new Error("could not find start_time in netlog");
        }

        const qlog: qlogschema.ITrace = {
            vantage_point: { type: qlogschema.VantagePointType.client },
            event_fields: ["time", "category", "event", "data"],
            common_fields: { protocol_type: "QUIC_HTTP3", reference_time: start_time.toString() },
            events: qlogEvents,
        };

        const qlogFile: qlogschema.IQLog = {
            qlog_version: "draft-02-wip",
            traces: [qlog],
        };

        return qlogFile;
    }
}