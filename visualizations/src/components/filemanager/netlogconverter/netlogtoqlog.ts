/* tslint:disable */

import * as qlogschema from '@/data/QlogSchema01';
import * as qlogschema02 from '@/data/QlogSchema02';
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
                "smallest_observed": 0,
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

/** calculateAckRanges is used to generate ACK ranges given the largestObserved and smallestObserved
 * packet number and an array of missing packets. See netlog example above.
 * 
 * @param largestObserved 
 * @param smallestObserved 
 * @param missing_packets 
 */
function calculateAckRanges(largestObserved: number, smallestObserved: number, missing_packets: Array<number>): Array<[number, number]> {
    const result: Array<[number, number]> = new Array<[number, number]>();

    if ( missing_packets.length === 0 ) {
         // no missing packets, everything between smallest and largest is acked
        return [ [ smallestObserved, largestObserved ] ];
    }
    else {
        missing_packets.sort((a, b) => a - b ); // sort ascending in-place (this *should not* be needed, but hey, let's make sure, shall we)
    
        // You might wonder: what if missing_packets' first entry is PN 0? 
        // Say you have an ACK frame that wishes to ACK packets 5-10, because 0-4 were lost
        // then smallestObserved would be 5, missing_packets would be empty and largestObserved would be 10, so we wouldn't even get in this situation
        // if we have an ACK frame of 0, 5-10 (so 1-4 are in missing_packets)
        // we'd get [0,0] here, which is what we want
        result.push([smallestObserved, missing_packets[0] - 1]); 

        let missingIndex:number = 0;

        // example: largestObserved is 20, missing_packets is [6,7,8,11], smallestObserved is 3 -> should result in [3,5], [9,10] and [12,20] as a acked ranges
        while ( missingIndex < missing_packets.length - 1 ) {
            // as long as missing packets are consecutive, we keep continuing
            // the moment there is a gap in the missing packets ( index + 1's value is not index's value + 1 ), we know we have an ack range
            // in the example, this happens as soon as missingIndex is 2 (value 8), because the value at missingIndex 3 is 11
            if ( missing_packets[ missingIndex + 1 ] !== missing_packets[ missingIndex ] + 1 ) {
                const from = missing_packets[ missingIndex     ] + 1; // example: 9
                const to   = missing_packets[ missingIndex + 1 ] - 1; // example: 10
                result.push( [from, to] );
            }   

            missingIndex += 1;
        }
        
        result.push( [missing_packets[missingIndex] + 1, largestObserved] ); // missingIndex is now at the end of the array, so that value + 1 to the largestObserved gives 12,20
    
        return result;
    }
}

class QUICConnection {
    public title: string;
    public session: netlogschema.QUIC_SESSION;
    public sessionId: number;
    public startTime: number;
    public qlogEvents: Array<Array<qlogschema.EventField>>;

    public txQUICFrames: Array<qlogschema.QuicFrame>;
    public rxQUICFrames: Array<qlogschema.QuicFrame>;
    public rxPacket: qlogschema02.IEventPacket | undefined;

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
            this.txQUICFrames.push(frame as qlogschema.QuicFrame);
        } else {
            this.rxQUICFrames.push(frame as qlogschema.QuicFrame);
        }
    }

    public pushH3Frame(
        event_type: string,
        frame: qlogschema.HTTP3EventData,
        qlogEvent: Array<qlogschema.EventField>,
    ) {
        qlogEvent.push(qlogschema.EventCategory.http);

        if (event_type.indexOf('SENT') >= 0) {
            qlogEvent.push(qlogschema.HTTP3EventType.frame_created);
        } else {
            qlogEvent.push(qlogschema.HTTP3EventType.frame_parsed);
        }

        qlogEvent.push(frame);
        this.qlogEvents.push(qlogEvent);
    }
}

// tslint:disable max-classes-per-file
export default class NetlogToQlog {

    public static convert(netlogJSON: netlogschema.Netlog): qlogschema.IQLog {
        console.log("NetlogToQlog: converting file with " + netlogJSON.events.length + " events");

        // unit tests would be nice for this type of thing...
        // console.error("Calculate ack ranges", calculateAckRanges( 2115, 2050, [2056,2057,2058,2059,2060,2061,2062,2063,2064,2065,2066,2067,2068,2069,2070,2071,2072,2073,2074,2075,2076,2077,2078,2079,2080,2081,2082,2083,2084,2085,2086,2087,2088,2089,2090,2091,2092,2093,2094,2095,2096,2097,2098,2099,2100,2101,2102,2103,2104,2105,2106,2107,2108,2109,2110,2111,2112,2113,2114] )); // should be [2050,2055],[2155,2155]
        // console.error("Calculate ack ranges 2", calculateAckRanges(20, 3, [6,7,8,11]) ); // should be [3,5],[9-10],[12-20]
        // console.error("Calculate ack ranges 3", calculateAckRanges(20, 11, [12]) ); // should be [11,11],[13-20]
        // console.error("Calculate ack ranges 4", calculateAckRanges(20, 20, []) ); // should be [20,20]
        // console.error("Calculate ack ranges 5", calculateAckRanges(20, 3, [5,7]) ); // should be [3,4],[6,6],[8,20]

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
                console.error("netlog2qlog:convert : unknown source type!", event, source_type);
                continue;
            }

            // Right now only support events part of a QUIC session
            if (source_type !== 'QUIC_SESSION') {
                // console.error("netlog2qlog:convert : unsupported source type!", event, source_type);
                continue;
            }

            // source id of event
            const source_id: number = event.source.id;

            // event_type of event
            const event_type: string | undefined = event_types.get(event.type);
            if (event_type === undefined) {
                console.error("netlog2qlog:convert : unknown event type!", event, event_type);
                continue;
            }

            // phase of event
            const phase: string | undefined = phases.get(event.phase);
            if (phase === undefined) {
                console.error("netlog2qlog:convert : unknown event phase!", event, phase);
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
                
                if ( event_type !== "QUIC_SESSION" ) {
                    console.warn("netlogtoqlog:convert : new connection found, but first event was not QUIC_SESSION! Not sure this will work...", event, event_type, source_type, connectionMap);
                }
                if ( phase !== "PHASE_BEGIN" ) {
                    console.warn("netlogtoqlog:convert : connection starting in phase other than PHASE_BEGIN! Not sure this will work...", event, event_type, phase);
                }

                // Create new connection
                const session: netlogschema.QUIC_SESSION = params;
                connection = new QUICConnection(session, source_id, +event.time)
                connectionMap.set(source_id, connection);
            }

            if (connection === undefined) {
                console.error("netlog2qlog:convert : could not match event to connection", event, event_type, source_id);
                continue;
            }

            // event time in ms
            const time: number = +event.time - connection.startTime;

            // Create a new qlog event with relative time
            const qlogEvent: Array<qlogschema.EventField> = new Array<qlogschema.EventField>();
            qlogEvent.push(time);

            switch (event_type) {
                case 'QUIC_SESSION': {
                    const event_params: netlogschema.QUIC_SESSION = params;
                    // const data: qlogschema.IEventConnectionStarted = {
                    //     ip_version: string;
                    //     src_ip: string;
                    //     dst_ip: string;
                    //     protocol?: string;
                    //     src_port: number;
                    //     dst_port: number;
                    //     quic_version?: string;
                    //     src_cid?: string;
                    //     dst_cid?: string;
                    // };
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
                        event_params.smallest_observed,
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

                case 'QUIC_SESSION_RST_STREAM_FRAME_SENT':
                case 'QUIC_SESSION_RST_STREAM_FRAME_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_RST_STREAM_FRAME = params;
                    const frame: qlogschema.IResetStreamFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.reset_stream,
                        stream_id: event_params.stream_id.toString(),
                        error_code: event_params.quic_rst_stream_error,
                        final_size: event_params.offset.toString(),
                    };
                    connection.pushFrame(event_type, frame);
                    break;
                }

                case 'QUIC_SESSION_STOP_SENDING_FRAME_SENT':
                case 'QUIC_SESSION_STOP_SENDING_FRAME_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_STOP_SENDING_FRAME = params;
                    const frame: qlogschema.IStopSendingFrame = {
                        frame_type: qlogschema.QUICFrameTypeName.stop_sending,
                        stream_id: event_params.stream_id.toString(),
                        error_code: event_params.application_error_code,
                    };
                    connection.pushFrame(event_type, frame);
                    break;
                }

                case 'QUIC_SESSION_CRYPTO_HANDSHAKE_MESSAGE_SENT':
                case 'QUIC_SESSION_CRYPTO_HANDSHAKE_MESSAGE_RECEIVED': {
                    const event_params: netlogschema.QUIC_SESSION_CRYPTO_HANDSHAKE_MESSAGE = params;
                    // Don't know what qlogschema frame to use here
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
                            case netlogschema.PacketType.zerortt:
                                return qlogschema.PacketType.zerortt;
                            case netlogschema.PacketType.onertt:
                                return qlogschema.PacketType.onertt;
                            default:
                                console.error("netlog2qlog:convert: unknown packet type sent", event_params.encryption_level);

                                return qlogschema.PacketType.unknown;
                        }
                    })();

                    // Deep-copy txQUICFrames to put in qlogEvent.
                    const frames: Array<qlogschema.QuicFrame> = new Array<qlogschema.QuicFrame>();
                    connection.txQUICFrames.forEach((frame) => frames.push(Object.assign({}, frame)));

                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.packet_sent);
                    qlogEvent.push({
                        header: {
                            packet_type,
                            packet_number: event_params.packet_number.toString(),
                        },
                        frames,
                        raw: {
                            length: event_params.size,
                        },
                    } as any);
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
                    const packet: qlogschema02.IEventPacket = {
                        header: {
                            packet_type: qlogschema.PacketType.unknown, // placeholder, filled in below
                            packet_number: '', // placeholder, filled in below
                        },
                        is_coalesced: false,
                        raw: {
                            length: event_params.size,
                        },
                    }

                    // Push placeholder qlogEvent into the trace
                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.packet_received);
                    qlogEvent.push(packet);
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

                        connection.rxPacket.frames = frames;
                    }

                    // Set rxPacket to current packet and reset rxQUICFrames
                    connection.rxPacket = packet;
                    connection.rxQUICFrames.length = 0;

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
                            case netlogschema.LONG_HEADER_TYPE.zerortt:
                                return qlogschema.PacketType.zerortt;
                            case netlogschema.LONG_HEADER_TYPE.retry:
                                return qlogschema.PacketType.retry;
                            case netlogschema.LONG_HEADER_TYPE.version_negotiation:
                                return qlogschema.PacketType.version_negotiation;
                            case netlogschema.LONG_HEADER_TYPE.invalid:
                                return qlogschema.PacketType.unknown;
                            default:
                                return qlogschema.PacketType.onertt;
                        }
                    })();

                    // In case we encounter packet_header_received before packet_received
                    // Caveat: Will not have packet length
                    if (connection.rxPacket === undefined) {
                        connection.rxPacket = {
                            header: {
                                packet_type: packet_type,
                                packet_number: event_params.packet_number.toString(),
                            },
                            is_coalesced: false,
                        };
                    }

                    connection.rxPacket.header.packet_type = packet_type;
                    connection.rxPacket.header.packet_number = event_params.packet_number.toString();

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

                case 'QUIC_SESSION_PACKET_LOST': {
                    const event_params: netlogschema.QUIC_SESSION_PACKET_LOST = params;
                    const packet_type: qlogschema.PacketType = (() => {
                        switch (event_params.transmission_type) {
                            default:
                                return qlogschema.PacketType.unknown;
                        }
                    })();
                    const packet: qlogschema02.IEventPacketLost = {
                        header: {
                            packet_type,
                            packet_number: event_params.packet_number.toString(),
                        },
                    }
                    qlogEvent.push(qlogschema.EventCategory.recovery);
                    qlogEvent.push(qlogschema.RecoveryEventType.packet_lost);
                    qlogEvent.push(packet);
                    connection.qlogEvents.push(qlogEvent);
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
                    // const frame: qlogschema.IEventPacketBuffered = {
                    //     packet_type: qlogschema.PacketType.onertt,
                    // }
                    // qlogEvent.push(qlogschema.EventCategory.transport);
                    // qlogEvent.push(qlogschema.TransportEventType.packet_buffered);
                    // qlogEvent.push(frame);
                    // connection.qlogEvents.push(qlogEvent);
                    break;
                }

                case 'QUIC_SESSION_DROPPED_UNDECRYPTABLE_PACKET': {
                    const event_params: netlogschema.QUIC_SESSION_DROPPED_UNDECRYPTABLE_PACKET = params;
                    const packet_type : qlogschema.PacketType = (() => {
                        switch (event_params.encryption_level) {
                            case "ENCRYPTION_HANDSHAKE":
                                return qlogschema.PacketType.handshake;                        
                            default:
                                return qlogschema.PacketType.unknown;
                        }
                    })();
                    const frame: qlogschema02.IEventPacketDropped = {
                        header: {
                            packet_type,
                            packet_number: "", // not always known
                        },
                    }
                    qlogEvent.push(qlogschema.EventCategory.transport);
                    qlogEvent.push(qlogschema.TransportEventType.packet_dropped);
                    qlogEvent.push(frame as any);
                    connection.qlogEvents.push(qlogEvent);
                    break;
                }

                case 'QUIC_CHROMIUM_CLIENT_STREAM_SEND_REQUEST_HEADERS':
                case 'QUIC_CHROMIUM_CLIENT_STREAM_READ_RESPONSE_HEADERS': {
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

                case 'HTTP3_PEER_CONTROL_STREAM_CREATED':
                case 'HTTP3_LOCAL_CONTROL_STREAM_CREATED': {
                    const event_params: netlogschema.HTTP3_STREAM_CREATED = params;
                    const owner: 'remote' | 'local' = ((): 'remote' | 'local' => {
                        if (event_type.indexOf('PEER') >= 0) {
                            return 'remote';
                        } else {
                            return 'local';
                        }
                    })();
                    const frame: qlogschema.IEventH3StreamTypeSet = {
                        stream_id: event_params.stream_id.toString(),
                        owner,
                        new: qlogschema.H3StreamType.control,
                    }
                    qlogEvent.push(qlogschema.EventCategory.http);
                    qlogEvent.push(qlogschema.HTTP3EventType.stream_type_set);
                    qlogEvent.push(frame);
                    connection.qlogEvents.push(qlogEvent);
                    break;
                }

                case 'HTTP3_PEER_QPACK_DECODER_STREAM_CREATED':
                case 'HTTP3_LOCAL_QPACK_DECODER_STREAM_CREATED': {
                    const event_params: netlogschema.HTTP3_STREAM_CREATED = params;
                    const owner: 'remote' | 'local' = ((): 'remote' | 'local' => {
                        if (event_type.indexOf('PEER') >= 0) {
                            return 'remote';
                        } else {
                            return 'local';
                        }
                    })();
                    const frame: qlogschema.IEventH3StreamTypeSet = {
                        stream_id: event_params.stream_id.toString(),
                        owner,
                        new: qlogschema.H3StreamType.qpack_decode,
                    }
                    qlogEvent.push(qlogschema.EventCategory.http);
                    qlogEvent.push(qlogschema.HTTP3EventType.stream_type_set);
                    qlogEvent.push(frame);
                    connection.qlogEvents.push(qlogEvent);
                    break;
                }

                case 'HTTP3_PEER_QPACK_ENCODER_STREAM_CREATED':
                case 'HTTP3_LOCAL_QPACK_ENCODER_STREAM_CREATED': {
                    const event_params: netlogschema.HTTP3_STREAM_CREATED = params;
                    const owner: 'remote' | 'local' = ((): 'remote' | 'local' => {
                        if (event_type.indexOf('PEER') >= 0) {
                            return 'remote';
                        } else {
                            return 'local';
                        }
                    })();
                    const frame: qlogschema.IEventH3StreamTypeSet = {
                        stream_id: event_params.stream_id.toString(),
                        owner,
                        new: qlogschema.H3StreamType.qpack_encode,
                    }
                    qlogEvent.push(qlogschema.EventCategory.http);
                    qlogEvent.push(qlogschema.HTTP3EventType.stream_type_set);
                    qlogEvent.push(frame);
                    connection.qlogEvents.push(qlogEvent);

                    break;
                }

                case 'HTTP3_SETTINGS_RECEIVED':
                case 'HTTP3_SETTINGS_SENT': {
                    const event_params: netlogschema.HTTP3_SETTINGS = params;
                    const owner: 'remote' | 'local' = ((): 'remote' | 'local' => {
                        if (event_type.indexOf('SENT') >= 0) {
                            return 'local';
                        } else {
                            return 'remote';
                        }
                    })();
                    const frame: qlogschema.IEventH3ParametersSet = {
                        owner,
                        max_header_list_size: event_params.SETTINGS_MAX_HEADER_LIST_SIZE,
                        max_table_capacity: event_params.SETTINGS_QPACK_MAX_TABLE_CAPACITY,
                        blocked_streams_count: event_params.SETTINGS_QPACK_BLOCKED_STREAMS,
                    };
                    qlogEvent.push(qlogschema.EventCategory.http);
                    qlogEvent.push(qlogschema.HTTP3EventType.parameters_set);
                    qlogEvent.push(frame);
                    connection.qlogEvents.push(qlogEvent);
                    break;
                }

                case 'HTTP3_MAX_PUSH_ID_RECEIVED':
                case 'HTTP3_MAX_PUSH_ID_SENT': {
                    const event_params: netlogschema.HTTP3_MAX_PUSH_ID = params;
                    const frame: qlogschema.IMaxPushIDFrame = {
                        frame_type: qlogschema.HTTP3FrameTypeName.max_push_id,
                        push_id: event_params.push_id.toString(),
                    };
                    break;
                }

                case 'HTTP3_HEADERS_DECODED':
                case 'HTTP3_HEADERS_SENT': {
                    const event_params: netlogschema.HTTP3_HEADERS = params;
                    const headers: Array<qlogschema.IHTTPHeader> = Object.entries(event_params.headers).map(([key, value]) => {
                        return { name: key, value };
                    });
                    const frame: qlogschema.IEventH3FrameCreated = {
                        stream_id: event_params.stream_id.toString(),
                        frame: {
                            frame_type: qlogschema.HTTP3FrameTypeName.headers,
                            headers,
                        },
                    };
                    connection.pushH3Frame(event_type, frame, qlogEvent)
                    break;
                }

                case 'HTTP3_PRIORITY_UPDATE_RECEIVED':
                case 'HTTP3_PRIORITY_UPDATE_SENT': {
                    const event_params: netlogschema.HTTP3_PRIORITY_UPDATE = params;
                    // Not supported yet
                    break;
                }

                case 'HTTP3_DATA_SENT': {
                    break;
                }

                case 'HTTP3_DATA_FRAME_RECEIVED': {
                    const event_params: netlogschema.HTTP3_DATA_FRAME = params;
                    const frame: qlogschema.IEventH3FrameParsed = {
                        stream_id: event_params.stream_id.toString(),
                        frame: {
                            frame_type: qlogschema.HTTP3FrameTypeName.data,
                        },
                        byte_length: event_params.payload_length.toString(),
                    };
                    connection.pushH3Frame(event_type, frame, qlogEvent);
                    break;
                }

                case 'HTTP3_UNKNOWN_FRAME_RECEIVED': {
                    break;
                }

                case 'HTTP3_HEADERS_RECEIVED': {
                    // Not in use
                    break;
                }

                case 'CERT_VERIFIER_REQUEST': {
                    qlogEvent.push(qlogschema.EventCategory.info);
                    qlogEvent.push(qlogschema.GenericEventType.marker);

                    if (phase === 'PHASE_BEGIN') {
                        qlogEvent.push('CERT_VERIFIER_REQUEST BEGIN')
                    } else {
                        qlogEvent.push('CERT_VERIFIER_REQUEST END')
                    }
                    connection.qlogEvents.push(qlogEvent);
                    break;
                }

                default: {
                    // Netlog event types not yet covered
                    console.warn("netlog2qlog:convert : unknown QUIC event, not supported yet!", event, event_type);
                    break;
                }
            }
        }

        const qlogs: Array<qlogschema.ITrace> = new Array<qlogschema.ITrace>();

        connectionMap.forEach((conn: QUICConnection, key: number) => {
            if (conn.qlogEvents.length > 0) {
                qlogs.push({
                    title: conn.title,
                    vantage_point: { type: qlogschema.VantagePointType.client },
                    event_fields: ["relative_time", "category", "event", "data"],
                    common_fields: { protocol_type: "QUIC_HTTP3", reference_time: conn.startTime.toString() },
                    events: conn.qlogEvents,
                });
            }
            else {
                console.warn("netlogtoqlog:convert : QUIC connection found but not events logged for this one for some reason... netlog sometimes has QUIC_SESSION_CLOSED events due to timeouts and those are not linked to the real original connection at this time, which is the likely source of this warning.", conn);
            }
        });

        const qlogFile: qlogschema.IQLog = {
            qlog_version: "draft-01",
            traces: qlogs,
        };

        return qlogFile;
    }
}
