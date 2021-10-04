
import * as qlogschema from '@/data/QlogSchema';

/* tslint:disable */

export enum PacketType {
    initial = "ENCRYPTION_INITIAL",
    handshake = "ENCRYPTION_HANDSHAKE",
    zerortt = "ENCRYPTION_ZERO_RTT",
    onertt = "ENCRYPTION_FORWARD_SECURE",
}

export interface Netlog {
    constants: any,
    events: Array<Event>,
}

export interface Constants {
    logEventTypes: any,
    logSourceType: any,
    logEventPhase: any,
    timeTickOffset: number,
}

export interface Event {
    params: any,
    phase: number,
    source: EventSource,
    time: string,
    type: number,
}

export interface EventSource {
    id: number,
    start_time: string,
    type: number,
}

export interface QUIC_SESSION {
    cert_verify_flags?: number,
    connection_id?: string,
    host: string,
    network_isolation_key?: string,
    port?: number,
    privacy_mode?: string,
    require_confirmation?: boolean,
    versions?: string,
}

export interface QUIC_SESSION_PACKET_SENT {
    encryption_level: PacketType,
    packet_number: number,
    sent_time_us: number,
    size: number,
    transmission_type: string
}

export interface QUIC_SESSION_COALESCED_PACKET_SENT {
    info: string
}

export interface QUIC_SESSION_COALESCED_PACKET {
    total_length: string,
    padding_size: string,
    packets: string,
}

export interface QUIC_SESSION_TRANSPORT_PARAMETERS {
    quic_transport_parameters: string
}

export interface QUIC_SESSION_PADDING_FRAME {
    num_padding_bytes: number
}

export interface QUIC_SESSION_CRYPTO_FRAME {
    bytes?: string,
    data_length: number,
    encryption_level: string,
    offset: number
}

export interface QUIC_SESSION_ACK_FRAME {
    delta_time_largest_observed_us: number,
    largest_observed: number,
    smallest_observed: number, // see also: https://bugs.chromium.org/p/chromium/issues/detail?id=1112925
    missing_packets: Array<number>,
    received_packet_times: Array<any>
}

export interface QUIC_SESSION_RST_STREAM_FRAME {
    offset: number,
    quic_rst_stream_error: number,
    stream_id: number
}

export interface QUIC_SESSION_STOP_SENDING_FRAME {
    application_error_code: number,
    stream_id: number
}

export interface QUIC_SESSION_STREAM_FRAME {
    fin: boolean,
    length: number,
    offset: number,
    stream_id: number
}

export interface QUIC_SESSION_WINDOW_UPDATE_FRAME {
    byte_offset: number,
    stream_id: number
}

export interface QUIC_SESSION_CRYPTO_HANDSHAKE_MESSAGE {
    quic_crypto_handshake_message: string,
}

export interface QUIC_SESSION_CONNECTION_CLOSE_FRAME_SENT {
    details: string,
    quic_error: number
}

export interface QUIC_SESSION_PACKET_RECEIVED {
    peer_address: string,
    self_address: string,
    size: number
}

export interface QUIC_SESSION_PACKET_LOST {
    detection_time_us: number,
    packet_number: number,
    transmission_type: string,
}

export enum LONG_HEADER_TYPE {
    initial = "INITIAL",
    handshake = "HANDSHAKE",
    zerortt = "ZERO_RTT_PROTECTED",
    version_negotiation = "VERSION_NEGOTIATION",
    retry = "RETRY",
    invalid = "INVALID_PACKET_TYPE",
}

export interface QUIC_SESSION_UNAUTHENTICATED_PACKET_HEADER_RECEIVED {
    connection_id: string,
    header_format: string,
    long_header_type?: LONG_HEADER_TYPE,
    packet_number: number
}

export interface QUIC_SESSION_DROPPED_UNDECRYPTABLE_PACKET {
    encryption_level: string
}

export interface QUIC_SESSION_CLOSED {
    details: string,
    from_peer: boolean,
    quic_error: number
}

export interface HTTP3_STREAM_CREATED {
    stream_id: number,
}

export interface HTTP3_MAX_PUSH_ID {
    push_id: number,
}

export interface HTTP3_PRIORITY_UPDATE {
    prioritized_element_id: number,
    priority_field_value: string,
    type: string
}

export interface HTTP3_DATA_FRAME {
    payload_length: number,
    stream_id: number
}

export interface HTTP3_UNKNOWN_FRAME {
    frame_type: number,
    payload_length: number,
    stream_id: number
}

export interface HTTP3_HEADERS {
    headers: Map<string, string>,
    stream_id: number,
}

export interface HTTP3_SETTINGS {
    SETTINGS_MAX_HEADER_LIST_SIZE: number,
    SETTINGS_QPACK_BLOCKED_STREAMS: number,
    SETTINGS_QPACK_MAX_TABLE_CAPACITY: number,
}
