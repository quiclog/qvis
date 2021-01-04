import * as qlogschema from "@/data/QlogSchema";

export enum EventCategory {
    tcp = "transport",
    tls = "tls",
    http2 = "http2",
}

export enum TCPEventType {
    packet_sent = "packet_sent",
    packet_received = "packet_received",
}

export enum TLSEventType {
    record_created = "record_created",
    record_parsed = "record_parsed",
}

export type quint64 = number | string;
export type qbytes = string;

export interface IRawInfo {
    length?: quint64,
    payload_length?: quint64,

    data?: qbytes
}

export enum HTTP2EventType {
    frame_created = "frame_created",
    frame_parsed = "frame_parsed",
}

export interface IEventPacketSent {
    header: ITCPPacketHeader,
    raw?: IRawInfo,

    details?: Array<IPacketDetail>,
}

export interface IEventPacketReceived{
    header: ITCPPacketHeader,
    raw?: IRawInfo,

    details?: Array<IPacketDetail>,

    // TODO: add : options?; Array<IPacketOptions>,
}

export interface ITCPPacketHeader {
    sequence_number: number;
    packet_size?: number;
    payload_length?: number;
    header_length?:number;

    // QUIC qlogschema compatibility, not actually used here
    packet_type: qlogschema.PacketType; // TCP can be considered as always QUIC's 1RTT equivalent. Need to keep parity with QUIC-based qlog atm
    packet_number: qlogschema.quint64;
}

export type IPacketDetail = IPacketAcks | IPacketFlowControl;

export enum TCPPacketDetailName {
    ack = "ack",
    flow_control = "flow_control",
    flags = "flags",
}

export interface IPacketFlags {
    type:TCPPacketDetailName.flags,

    syn?:boolean,
    ack?:boolean,
    reset?:boolean,
    fin?:boolean,
}

export interface IPacketAcks {
    type:TCPPacketDetailName.ack,
}

export interface IPacketFlowControl {
    type:TCPPacketDetailName.flow_control,
}

export interface IEventRecordCreated {
    header:IRecordHeader,

    raw?:string
}

export interface IEventRecordParsed {
    header:IRecordHeader,

    raw?:string
}

export interface IRecordHeader {
    content_type?:"handshake"|"alert"|"application"|"change-cipherspec"|"unknown",
    version?:string,
    payload_length?:number,
    header_length?:number,
    trailer_length?:number,

    DEBUG_wiresharkFrameNumber?:number,

    // QUIC qlogschema compatibility, not actually used here
    packet_type:qlogschema.PacketType, // QUIC qlog compat mode
    packet_number:quint64, // QUIC qlog compat mode
}


export interface IEventH2FrameCreated {
    stream_id:number,
    frame:HTTP2Frame,
    payload_length?:number,
    header_length?:number,

    raw?:string
}

export interface IEventH2FrameParsed {
    stream_id:number,
    frame:HTTP2Frame,
    payload_length?:number,
    header_length?:number,

    raw?:string
}

export enum HTTP2FrameTypeName {
    data = "data",
    headers = "headers",
    priority = "priority",
    reset_stream = "reset_stream",
    settings = "settings",
    push_promise = "push_promise",
    ping = "ping",
    go_away = "go_away",
    window_update = "window_update",
    continuation = "continuation",
    unknown = "unknown",
    magic = "magic",
}


export type HTTP2Frame = IDataFrame | IHeadersFrame | ISettingsFrame | IUnknownFrame | IAnyFrame;

export interface IDataFrame{
    frame_type:HTTP2FrameTypeName.data,

    byte_length?:number,
    stream_end?:boolean,

    raw?:string
}

export interface IHeadersFrame {
    frame_type:HTTP2FrameTypeName.headers,
    byte_length?:number,

    headers:Array<IHTTPHeader>,

    stream_end?:boolean,
    raw?:string
}

export interface IHTTPHeader {
    name:string,
    value:string,
}

export interface ISettingsFrame {
    frame_type:HTTP2FrameTypeName.settings,
    byte_length?:number,

    raw?:string
}

// TODO: replace with proper frame definitions for all the different frame types!
export interface IAnyFrame {
    frame_type:HTTP2FrameTypeName,
    byte_length?:number,

    raw?:string
}

export interface IUnknownFrame {
    frame_type:HTTP2FrameTypeName.unknown,
    byte_length?:number,

    raw?:string
}
