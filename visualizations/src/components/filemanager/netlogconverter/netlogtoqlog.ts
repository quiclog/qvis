import * as qlogschema from '@quictools/qlog-schema';
import * as netlogschema from './netlog';

/* Netlog example:
{
    "constants": {
        "logEventTypes": {
            "QUIC_SESSION": 234,
            "QUIC_SESSION_ACK_FRAME_SENT": 249,
            ...
        },
        "logSourceType": {
            "QUIC_SESSION": 11,
            ...
        },
        ...
    },
    "events": [
        {
            "params": {
                "cert_verify_flags": 0,
                "connection_id": "712d0120daf2c0be",
                "host": "accounts.google.com",
                "network_isolation_key": "null null",
                "port": 443,
                "privacy_mode": "disabled",
                "require_confirmation": false,
                "versions": "ff00001d"
            },
            "phase": 1,
            "source": {
                "id": 16,
                "start_time": "300131887",
                "type": 11
            },
            "time": "300131887",
            "type": 234
        },
        ...,
        {
            "params": {
                "delta_time_largest_observed_us": 9688,
                "largest_observed": 11,
                "missing_packets": [
                    1,
                    3,
                    6,
                    9
                ],
                "received_packet_times": []
            },
            "phase": 0,
            "source": {
                "id": 28,
                "start_time": "300131911",
                "type": 11
            },
            "time": "300132616",
            "type": 249
        },
        ...
    ]
}
 */

/** invertMap is used to invert mappings of netlog constants because netlog stores
 *  constants as <string, number> while events use <number> to represent constants.
 *  See netlog example above.
 * @param map 
 */
function invertMap(map: Map<string, number>): Map<number, string> {
    const result: Map<number, string> = new Map<number, string>();

    Object.entries(map).forEach((entry) => {
        const value: number = entry[1] as number;
        result.set(value, entry[0]);
    });

    return result;
};

/** calculateAckRanges is used to generate ACK ranges given the largestObserved
 * packet number and an array of missing packets. See netlog example above.
 * 
 * @param largestObserved 
 * @param missing_packets 
 */
function calculateAckRanges(largestObserved: number, missing_packets: Array<number>): Array<[number, number]> {
    const result: Array<[number, number]> = new Array<[number, number]>();

    let curr: number = 1;
    for (const packetNum of missing_packets) {
        if (curr !== packetNum) {
            result.push([curr, packetNum - 1]);
        }
        curr = packetNum + 1;
    }
    result.push([curr, largestObserved]);

    return result
}

class QUICConnection {
    public title: string;
    public session: netlogschema.QUIC_SESSION;
    public sessionId: number;
    public startTime: number;
    public qlogEvents: Array<Array<qlogschema.EventField>>;
    public txQUICFrames: Array<qlogschema.QuicFrame>;
    public rxQUICFrames: Array<qlogschema.QuicFrame>;
    public rxPacket: any | undefined;

    constructor(
        session: netlogschema.QUIC_SESSION,
        sessionId: number,
        startTime: number,
    ) {
        this.title = `${session.host}-${session.connection_id}`;
        this.session = session;
        this.sessionId = sessionId;
        this.startTime = startTime;
        this.qlogEvents = new Array<Array<qlogschema.EventField>>();

        // txQUICFrames is used to buffer frames that correspond with a sent packet.
        // This is done because netlog first logs FRAME_SENT before it logs
        // PACKET_SENT, the latter of which contains the packet number. As a result,
        // we must keep track of current frames sent until we encounter a PACKET_SENT event
        // to accurately assign frames to a specific packet
        this.txQUICFrames = new Array<qlogschema.QuicFrame>();

        // rxQUICFrames is used to buffer frames that correspond with a received packet.
        // This is done because netlog first logs PACKET_HEADER_RECEIVED before it logs
        // FRAME_RECEIVED, the former of which contains the packet number. As a result,
        // we must keep track of current frames received after we encounter a 
        // PACKET_HEADER_RECEIVED event to accurately assign frames to a specific packet.
        this.rxQUICFrames = new Array<qlogschema.QuicFrame>();
        // This is to keep track of the last received packet. We need to keep track
        // because we can only log a received packet to QLOG until we encounter the
        // next received packet due to frame buffering nature.
        this.rxPacket = undefined;
    }

    public pushFrame(event_type: string, frame: qlogschema.QuicFrame) {
        if (event_type.indexOf('SENT') >= 0) {
            this.txQUICFrames.push(frame);
        } else {
            this.rxQUICFrames.push(frame);
        }
    }
}

// tslint:disable max-classes-per-file
export default class NetlogToQlog {

    public static convert(netlogJSON: netlogschema.Netlog): qlogschema.IQLog {
        console.log("NetlogToQlog: converting file with " + netlogJSON.events.length + " events");

        const constants: netlogschema.Constants = netlogJSON.constants;
        const events: Array<netlogschema.Event> = netlogJSON.events;

        // TODO: Use this timeTickOffset for accurate absolute start time
        const timeTickOffset: number = constants.timeTickOffset;

        const event_types: Map<number, string> = invertMap(constants.logEventTypes);
        const source_types: Map<number, string> = invertMap(constants.logSourceType);
        const phases: Map<number, string> = invertMap(constants.logEventPhase);


        const connectionMap: Map<number, QUICConnection> = new Map<number, QUICConnection>();

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

            // event params
            const params: any = event.params;

            let connection: QUICConnection | undefined = undefined;

            // Connection already exists
            if (connectionMap.has(source_id)) {
                connection = connectionMap.get(source_id);
            }
            // Connection doesn't exist 
            else {
                // Only allow to create connection on type QUIC_SESSION
                if (event_type !== 'QUIC_SESSION') {
                    continue;
                }
                // Only allow to create connection if phase is begin
                if (phase !== 'PHASE_BEGIN') {
                    continue;
                }
                // Create new connection
                const session: netlogschema.QUIC_SESSION = params;
                connection = new QUICConnection(session, source_id, +event.time)
                connectionMap.set(source_id, connection);
            }

            if (connection === undefined) {
                continue;
            }

            // event time in ms
            const time: number = +event.time - connection.startTime;

            // Create a new qlog event with relative time
            const qlogEvent: Array<qlogschema.EventField> = new Array<qlogschema.EventField>();
            qlogEvent.push(time);

            switch (event_type) {
                case 'QUIC_SESSION': {
                    continue;
                }

                case 'QUIC_SESSION_TRANSPORT_PARAMETERS_SENT': {
                    const event_params: Array<string> = (params as netlogschema.QUIC_SESSION_TRANSPORT_PARAMETERS)
                        .quic_transport_parameters
                        .split(" ")
                        .slice(1);
                    const data: any = { owner: 'local' };
                    for (let i = 0; i < event_params.length; i += 2) {
                        const key: string = event_params[i];
                        const value: string = event_params[i + 1];
                        data[key] = value;
                    }

                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.parameters_set);
                    qlogEvent.push(data as qlogschema.IEventTransportParametersSet);
                    connection.qlogEvents.push(qlogEvent);
                    break;
                }

                case 'QUIC_SESSION_CRYPTO_FRAME_SENT':
                case 'QUIC_SESSION_CRYPTO_FRAME_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_CRYPTO_FRAME = params;
                    const frame: qlogschema.ICryptoFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.crypto,
                        offset: event_params.offset.toString(),
                        length: event_params.data_length.toString(),
                    }
                    connection.pushFrame(event_type, frame);
                    break;
                }

                case 'QUIC_SESSION_PADDING_FRAME_SENT':
                case 'QUIC_SESSION_PADDING_FRAME_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_PADDING_FRAME = params;
                    const frame: qlogschema.IPaddingFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.padding,
                    }
                    connection.pushFrame(event_type, frame);
                    break;
                }

                case 'QUIC_SESSION_PING_FRAME_SENT':
                case 'QUIC_SESSION_PING_FRAME_RECEIVED': {
                    const frame: qlogschema.IPingFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.ping,
                    }
                    connection.pushFrame(event_type, frame);
                    break;
                }

                case 'QUIC_SESSION_STREAM_FRAME_SENT':
                case 'QUIC_SESSION_STREAM_FRAME_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_STREAM_FRAME = params;
                    const frame: qlogschema.IStreamFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.stream,
                        stream_id: event_params.stream_id.toString(),
                        offset: event_params.offset.toString(),
                        length: event_params.length.toString(),
                        fin: event_params.fin,
                    }
                    connection.pushFrame(event_type, frame);
                    break;
                }

                case 'QUIC_SESSION_ACK_FRAME_SENT':
                case 'QUIC_SESSION_ACK_FRAME_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_ACK_FRAME = params;
                    const acked_ranges: Array<[number, number]> = calculateAckRanges(
                        event_params.largest_observed,
                        event_params.missing_packets,
                    );
                    // TODO: Use delta_time_largest_observed_us to calculate ack delay 
                    const frame: qlogschema.IAckFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.ack,
                        acked_ranges: acked_ranges.map(([ack1, ack2]) => {
                            return [ack1.toString(), ack2.toString()];
                        }),
                    }
                    connection.pushFrame(event_type, frame);
                    break;
                }

                case 'QUIC_SESSION_WINDOW_UPDATE_FRAME_SENT':
                case 'QUIC_SESSION_WINDOW_UPDATE_FRAME_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_WINDOW_UPDATE_FRAME = params;
                    if (event_params.stream_id === -1) {
                        const frame: qlogschema.IMaxDataFrame = {
                            frame_type: qlogschema.QUICFrameTypeName.max_data,
                            maximum: event_params.byte_offset.toString(),
                        };
                        connection.pushFrame(event_type, frame);
                    } else {
                        const frame: qlogschema.IMaxStreamDataFrame = {
                            frame_type: qlogschema.QUICFrameTypeName.max_stream_data,
                            stream_id: event_params.stream_id.toString(),
                            maximum: event_params.byte_offset.toString(),
                        };
                        connection.pushFrame(event_type, frame);
                    }
                    break;
                }

                case 'QUIC_SESSION_CONNECTION_CLOSE_FRAME_SENT': {
                    const event_params: netlogschema.QUIC_SESSION_CONNECTION_CLOSE_FRAME_SENT = params;
                    const frame: qlogschema.IConnectionCloseFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.connection_close,
                        error_space: qlogschema.ErrorSpace.transport_error,
                        error_code: event_params.quic_error,
                        raw_error_code: event_params.quic_error,
                        reason: event_params.details,
                    };
                    connection.txQUICFrames.push(frame);
                    break;
                }

                case 'QUIC_SESSION_PACKET_SENT': {
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

                    // Deep-copy txQUICFrames to put in qlogEvent.
                    const frames: Array<qlogschema.QuicFrame> = new Array<qlogschema.QuicFrame>();
                    connection.txQUICFrames.forEach((frame) => frames.push(Object.assign({}, frame)));

                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.packet_sent);
                    qlogEvent.push({
                        packet_type,
                        header: {
                            packet_number: event_params.packet_number.toString(),
                            packet_size: event_params.size,
                        },
                        frames,
                    } as qlogschema.IEventPacket);
                    connection.qlogEvents.push(qlogEvent);

                    // Reset txQUICFrames
                    connection.txQUICFrames.length = 0;
                    break;
                }

                case 'QUIC_SESSION_COALESCED_PACKET_SENT': {
                    const event_params: netlogschema.QUIC_SESSION_COALESCED_PACKET_SENT = params;
                    break;
                }

                case 'QUIC_SESSION_PACKET_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_PACKET_RECEIVED = params;
                    break;
                }

                case 'QUIC_SESSION_UNAUTHENTICATED_PACKET_HEADER_RECEIVED': {
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


                    const packet: qlogschema.IEventPacket = {
                        packet_type,
                        header: {
                            packet_number: event_params.packet_number.toString(),
                        },
                        is_coalesced: false,
                    };

                    // Push placeholder qlogEvent into the trace
                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.packet_received);
                    qlogEvent.push({
                        packet_type,
                        header: {
                            packet_number: event_params.packet_number.toString(),
                        },
                        is_coalesced: false,
                    } as qlogschema.IEventPacket);
                    connection.qlogEvents.push(qlogEvent);

                    // if rxPacket is not undefined, then we have frames buffered
                    // to correlate with the last rxPacket. This is done because
                    // netlog first logs HEADER_RECEIVED (which contains the packet 
                    // number) before logging any frames that correspond with the packet.
                    // As a result, we must save rxPacket in memory and buffer frames we
                    // encounter after the HEADER_RECEIVED event to correctly correlate
                    // frames with packet.
                    if (connection.rxPacket !== undefined) {
                        // Deep-copy frames to put into qlogEvent
                        const frames: Array<qlogschema.QuicFrame> = new Array<qlogschema.QuicFrame>();
                        connection.rxQUICFrames.forEach((frame) => frames.push(Object.assign({}, frame)));

                        // Since we are dealing with a packet from the past, we must find its
                        // correct placeholder packet
                        for (let i = connection.qlogEvents.length - 1; i >= 0; i--) {
                            const temp_type: qlogschema.TransportEventType = connection.qlogEvents[i][2] as qlogschema.TransportEventType;
                            const temp_data: qlogschema.IEventPacket = connection.qlogEvents[i][3] as qlogschema.IEventPacket;
                            // If we found an event that matches packet, fill in its frames
                            if (
                                temp_type === qlogschema.TransportEventType.packet_received &&
                                packet.header.packet_number === connection.rxPacket.header.packet_number
                            ) {
                                temp_data.frames = frames;
                                break;
                            }
                        }
                    }

                    // Set rxPacket to current packet and reset rxQUICFrames
                    connection.rxPacket = packet;
                    connection.rxQUICFrames.length = 0;
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
                    connection.qlogEvents.push(qlogEvent);
                    break;
                }

                case 'QUIC_SESSION_HANDSHAKE_DONE_FRAME_RECEIVED': {
                    // No params
                    break;
                }

                case 'QUIC_SESSION_CLOSED': {
                    const event_params: netlogschema.QUIC_SESSION_CLOSED = params;
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
                    const event_params: netlogschema.HTTP3_STREAM_CREATED = params;
                    break;
                }

                case 'HTTP3_LOCAL_QPACK_DECODER_STREAM_CREATED': {
                    const event_params: netlogschema.HTTP3_STREAM_CREATED = params;

                    break;
                }

                case 'HTTP3_LOCAL_QPACK_ENCODER_STREAM_CREATED': {
                    const event_params: netlogschema.HTTP3_STREAM_CREATED = params;

                    break;
                }

                case 'HTTP3_PEER_CONTROL_STREAM_CREATED': {
                    const event_params: netlogschema.HTTP3_STREAM_CREATED = params;

                    break;
                }

                case 'HTTP3_PEER_QPACK_ENCODER_STREAM_CREATED': {
                    const event_params: netlogschema.HTTP3_STREAM_CREATED = params;

                    break;
                }

                case 'HTTP3_PEER_QPACK_DECODER_STREAM_CREATED': {
                    const event_params: netlogschema.HTTP3_STREAM_CREATED = params;

                    break;
                }

                case 'HTTP3_SETTINGS_SENT': {
                    break;
                }

                case 'HTTP3_MAX_PUSH_ID_SENT': {
                    break;
                }

                case 'HTTP3_HEADERS_RECEIVED': {
                    break;
                }

                case 'HTTP3_HEADERS_DECODED':
                case 'HTTP3_HEADERS_SENT': {
                    break;
                }

                case 'HTTP3_PRIORITY_UPDATE_SENT': {
                    break;
                }

                case 'HTTP3_SETTINGS_RECEIVED': {
                    const event_params: netlogschema.HTTP3_SETTINGS = params;
                    // qlogEvent.push(qlogschema.EventCategory.http);
                    // qlogEvent.push(qlogschema.HTTP3EventType.datagram_received)
                    // qlogEvent.push({
                    //     stream_id: 'asfda',
                    //     frame: {
                    //         frame_type: qlogschema.HTTP3FrameTypeName.settings,
                    //         settings: [],
                    //     },
                    // } as qlogschema.IEventH3FrameParsed);
                    // connection.qlogEvents.push(qlogEvent);
                    break;
                }



                case 'HTTP3_DATA_SENT': {
                    break;
                }

                case 'HTTP3_DATA_FRAME_RECEIVED': {
                    const event_params: netlogschema.HTTP3_DATA_FRAME = params;
                    qlogEvent.push(qlogschema.EventCategory.http);
                    qlogEvent.push(qlogschema.HTTP3EventType.datagram_received)
                    qlogEvent.push({
                        stream_id: event_params.stream_id.toString(),
                        byte_length: event_params.payload_length.toString(),
                        frame: {
                            frame_type: qlogschema.HTTP3FrameTypeName.data,
                        },
                    } as qlogschema.IEventH3FrameParsed);
                    connection.qlogEvents.push(qlogEvent);
                    break;
                }

                case 'HTTP3_UNKNOWN_FRAME_RECEIVED': {
                    break;
                }

                case 'HTTP3_HEADERS_DECODED': {
                    break;
                }

                case 'QUIC_CHROMIUM_CLIENT_STREAM_SEND_REQUEST_HEADERS': {
                    break;
                }

                case 'QUIC_CHROMIUM_CLIENT_STREAM_READ_RESPONSE_HEADERS': {
                    break;
                }

                default: {
                    // Netlog event types not yet covered
                    break;
                }
            }
        }

        const qlogs: Array<qlogschema.ITrace> = new Array<qlogschema.ITrace>();

        connectionMap.forEach((conn: QUICConnection, key: number) => {
            qlogs.push({
                title: conn.title,
                vantage_point: { type: qlogschema.VantagePointType.client },
                event_fields: ["relative_time", "category", "event", "data"],
                common_fields: { protocol_type: "QUIC_HTTP3", reference_time: conn.startTime.toString() },
                events: conn.qlogEvents,
            })
        });

        const qlogFile: qlogschema.IQLog = {
            qlog_version: "draft-02-wip",
            traces: qlogs,
        };

        return qlogFile;
    }
}
