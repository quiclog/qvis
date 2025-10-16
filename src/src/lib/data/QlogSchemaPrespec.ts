// copied over from https://github.com/quiclog/qlog/blob/master/TypeScript/draft-16/QLog.ts
// ================================================================== //
// Interface for QLog version pre-00, for quic draft 16
// ================================================================== //

export interface IQLog {
    qlog_version: string,
    connections: Array<IConnection>,
    description?: string
}

export interface IConnection {
    quic_version: string,
    vantagepoint: VantagePoint,
    metadata?: any, // TODO: possibly best to make this any POJO? will usually be a string description? 
    connectionid: string,
    starttime: number,
    fields: string[],
    events: Array<IEventTuple>, 
}

export type EventType = ConnectivityEventType | TransportEventType | SecurityEventType | RecoveryEventType;
export type EventTrigger = ConnectivityEventTrigger | TransporEventTrigger | SecurityEventTrigger | RecoveryEventTrigger;

export interface IEventTuple {
    0 : number,
    1 : EventCategory,
    2 : EventType,
    3 : EventTrigger,
    4 : EventData
} 

// ================================================================== //
// Based on QUIC draft 16
// ================================================================== //

export enum FrameTypeName {
    PADDING = "PADDING",
    RST_STREAM = "RST_STREAM",
    CONNECTION_CLOSE = "CONNECTION_CLOSE",
    APPLICATION_CLOSE = "APPLICATION_CLOSE",
    MAX_DATA = "MAX_DATA",
    MAX_STREAM_DATA = "MAX_STREAM_DATA",
    MAX_STREAM_ID = "MAX_STREAM_ID",
    PING = "PING",
    BLOCKED = "BLOCKED",
    STREAM_BLOCKED = "STREAM_BLOCKED",
    STREAM_ID_BLOCKED = "STREAM_ID_BLOCKED",
    NEW_CONNECTION_ID = "NEW_CONNECTION_ID",
    STOP_SENDING = "STOP_SENDING",
    RETIRE_CONNECTION_ID = "RETIRE_CONNECTION_ID",
    PATH_CHALLENGE = "PATCH_CHALLENGE",
    PATH_RESPONSE = "PATH_RESPONSE",
    STREAM = "STREAM",
    CRYPTO = "CRYPTO",
    NEW_TOKEN = "NEW TOKEN",
    ACK = "ACK",
    UNKNOWN_FRAME_TYPE = "UNKOWN_FRAME_TYPE",
}

export enum PacketType {
    INITIAL = "Initial",
    RETRY = "Retry",
    HANDSHAKE = "Handshake",
    ZERORTTPROTECTED = "0-RTT Protected",
    UNKOWN_PACKET_TYPE = "UNKOWN PACKET TYPE",
}

// ================================================================== //

export enum EventCategory {
    CONNECTIVITY = "CONNECTIVITY",
    SECURITY = "SECURITY",
    TRANSPORT = "TRANSPORT",
    RECOVERY = "RECOVERY",
}

export enum ConnectivityEventType {
    NEW_CONNECTION = "NEW_CONNECTION",
}

export enum ConnectivityEventTrigger {
    LINE = "LINE",
}

export enum TransportEventType {
    TRANSPORT_PACKET_RX = "PACKET_RX",
    STREAM_NEW = "STREAM_NEW",
    ACK_NEW = "ACK_NEW",
    MAXDATA_NEW = "MAXDATA_NEW",
    MAXSTREAMDATA_NEW = "MAXSTREAMDATA_NEW",
}

export enum TransporEventTrigger {
    LINE = "LINE",
    PACKET_TX = "PACKET_TX",
    PACKET_RX = "PACKET_RX",
}

export enum SecurityEventType {
    KEY_UPDATE = "KEY_UPDATE",
}

export enum SecurityEventTrigger {
    KEYLOG = "KEYLOG",
}

export enum RecoveryEventType {
    LOSS_DETECTION_ARMED = "LOSS_DETECTION_ARMED",
    LOSS_DETECTION_POSTPONED = "LOSS_DETECTION_POSTPONED",
    LOSS_DETECTION_TRIGGERED = "LOSS_DETECTION_TRIGGERED",
    BYTES_IN_FLIGHT_UPDATE = "BYTES_IN_FLIGHT_UPDATE",
    CWND_UPDATE = "CWND_UPDATE",
    RTT_UPDATE = "RTT_UPDATE",
}

export enum RecoveryEventTrigger {
    ACK_RX = "ACK_RX",
    PACKET_RX = "PACKET_RX",
    UNKNOWN = "UNKNOWN",
}


// ================================================================== //

export enum VantagePoint {
    CLIENT = "CLIENT",
    SERVER = "SERVER",
    NETWORK = "NETWORK",
}

export enum SSLSecrets {
    QUIC_SERVER_HANDSHAKE_TRAFFIC_SECRET = "QUIC_SERVER_HANDSHAKE_TRAFFIC_SECRET",
    QUIC_CLIENT_HANDSHAKE_TRAFFIC_SECRET = "QUIC_CLIENT_HANDSHAKE_TRAFFIC_SECRET",
    QUIC_SERVER_TRAFFIC_SECRET = "QUIC_SERVER_TRAFFIC_SECRET",
    QUIC_CLIENT_TRAFFIC_SECRET = "QUIC_CLIENT_TRAFFIC_SECRET",
    ADDITIONAL_SECRET = "ADDITIONAL_SECRET",
}

// ================================================================== //
// Data Interfaces for QLog Events
// ================================================================== //

export type EventData = IEventNewConnection | IEventKeyUpdate | IEventPacketRX;

export interface IEventNewConnection {
    ip_version: string,
    //TODO more restrictive types for IP?
    srcip: string,
    dstip: string,
    srcport: number,
    dstport: number,
}

// ================================================================== //

export interface IEventKeyUpdate {
    name: SSLSecrets,
    key: string
}

// ================================================================== //

export interface IEventPacketRX {
    raw_encrypted?: string
    header?: IPacketHeader,
    frames?: Array<IPacketFrame>
}

// TODO: potentially split in LongHeader and ShortHeader explicitly? 
export interface IPacketHeader {
    form: string,
    type: PacketType,
    version?: string,
    scil?: string,
    dcil?: string,
    scid?: string,
    dcid: string,
    payload_length: number,
    packet_number: string
}

export interface IPacketFrame {
    type: FrameTypeName,
    length: number
}

// ================================================================== //
