import * as qlogschema from '@quictools/qlog-schema';

export enum PacketType {
    initial = "ENCRYPTION_INITIAL",
    handshake = "ENCRYPTION_HANDSHAKE",
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
    cert_verify_flags: number,
    connection_id: string,
    host: string,
    network_isolation_key: string,
    port: number,
    privacy_mode: string,
    require_confirmation: boolean,
    versions: string,
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
    missing_packets: Array<number>,
    received_packet_times: Array<any>
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

export interface QUIC_SESSION_CONNECTION_CLOSE_FRAME_SENT {
    details: string,
    quic_error: number
}

export interface QUIC_SESSION_PACKET_RECEIVED {
    peer_address: string,
    self_address: string,
    size: number
}

export enum LONG_HEADER_TYPE {
    initial = "INITIAL",
    handshake = "HANDSHAKE",
}

export interface QUIC_SESSION_UNAUTHENTICATED_PACKET_HEADER_RECEIVED {
    connection_id: string,
    header_format: string,
    long_header_type?: LONG_HEADER_TYPE,
    packet_number: number
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

export interface HTTP3_SETTINGS {
    SETTINGS_MAX_HEADER_LIST_SIZE: number,
    SETTINGS_QPACK_BLOCKED_STREAMS: number,
    SETTINGS_QPACK_MAX_TABLE_CAPACITY: number,
}

export interface HTTP3_HEADERS {
    headers: any,
    stream_id: number,
}