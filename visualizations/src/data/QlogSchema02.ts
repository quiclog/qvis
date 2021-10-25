/* tslint:disable */

// TODO: FIXME: export from the proper qlog package once that's updated
// export * from "@quictools/qlog-schema/draft-02/QLog";

// ================================================================== //
// Interface for QLog version draft-02
// ================================================================== //

export class Defaults {
    public static versionName:string = "draft-02";
    // TODO: FIXME: make 0.3+ its own proper version. For now, it's identical to draft-02, so treating it as alias
    public static versionAliases:Array<string> = ["draft-02", "draft-02-RC1", "qlog-03-WIP", "0.3"];
}

export enum LogFormat {
    JSON = "JSON",
    NDJSON = "NDJSON",
    JSONSEQ = "JSON-SEQ",
}

export interface IQLog {
    qlog_version: string,
    qlog_format?: LogFormat,

    title?:string,
    description?: string,
    summary?:any,

    traces: Array<ITrace | ITraceError>
}

export interface ITraceError {
    error_description: string,
    uri: string,

    vantage_point?: IVantagePoint
}

export interface ITrace {
    vantage_point: IVantagePoint,
    title?:string,
    description?: string,

    configuration?: IConfiguration,

    common_fields?: ICommonFields,

    events: Array<IEvent>
}

export interface IEvent {
    time: number,

    name?: string,
    category?: string,
    type?: string,

    data: EventData,

    [additionalUserSpecifiedProperty: string]: any // e.g., group_id or time_format can be defined on a per-event basis
}

export interface IVantagePoint{
    name?: string,
    type: VantagePointType,
    flow?: VantagePointType.client | VantagePointType.server | VantagePointType.unknown // only if type === VantagePointType.NETWORK
}

export enum VantagePointType {
    client = "client",
    server = "server",
    network = "network",
    unknown = "unknown",
}

export interface IConfiguration{
    time_units?:"ms"|"us",
    time_offset?:string,

    original_uris?: Array<string>,

    // allow additional properties. This way, we can enforce proper types for the ones defined in the spec, see other properties
    [additionalUserSpecifiedProperty: string]: any
}

export enum TimeFormat {
    absolute = "absolute",
    relative = "relative",
    delta = "delta",
}

export interface ICommonFields {
    group_id?: string | Array<any>,
    protocol_type?: string,

    reference_time?:string,

    time_format?:TimeFormat,

    // allow additional properties. This way, we can enforce proper types for the ones defined in the spec, see other properties
    [additionalUserSpecifiedProperty: string]: any
}

// event names defined in the main schema, for easier usage
export enum IDefaultEventFieldNames {
    category = "category",
    event = "event",
    data = "data",

    time = "time",
    relative_time = "relative_time",
    delta_time = "delta_time",
}

export type EventType = ConnectivityEventType | TransportEventType | SecurityEventType | RecoveryEventType | HTTP3EventType | QPACKEventType | GenericEventType;

// FIXME: TODO: add something for the DATA definitions!
export type EventField = EventCategory | EventType | EventData | number | string; // number = for the time values, string = for unknown, user-specified fields

export type quint64 = number | string;
export type qbytes = string;

export interface IRawInfo {
    length?: number, // TODO should be quint64, but this makes parsing a lot more tedious in a lot of places
    payload_length?: number, // TODO should be quint64, but this makes parsing a lot more tedious in a lot of places

    data?: qbytes
}

// ================================================================== //
// Based on QUIC draft 23
// ================================================================== //

export enum EventCategory {
    connectivity = "connectivity",
    security = "security",
    transport = "transport",
    recovery = "recovery",
    http = "http",
    qpack = "qpack",

    error = "error",
    warning = "warning",
    info = "info",
    debug = "debug",
    verbose = "verbose",
    simulation = "simulation",
}

export enum ConnectivityEventType {
    server_listening = "server_listening",
    connection_started = "connection_started",
    connection_id_updated = "connection_id_updated",
    spin_bit_updated = "spin_bit_updated",
    connection_state_updated = "connection_state_updated",
}

export enum TransportEventType {
    parameters_set = "parameters_set",

    datagrams_sent = "datagrams_sent",
    datagrams_received = "datagrams_received",
    datagram_dropped = "datagram_dropped",

    packet_sent = "packet_sent",
    packet_received = "packet_received",
    packet_dropped = "packet_dropped",
    packet_buffered = "packet_buffered",

    frames_processed = "frames_processed",

    stream_state_updated = "stream_state_updated",
}

export enum SecurityEventType {
    key_updated = "key_updated",
    key_retired = "key_retired",
}

export enum RecoveryEventType {
    parameters_set = "parameters_set",
    metrics_updated = "metrics_updated",
    congestion_state_updated = "congestion_state_updated",

    loss_timer_set = "loss_timer_set",
    loss_timer_triggered = "loss_timer_triggered",

    packet_lost = "packet_lost",
    marked_for_retransmit = "marked_for_retransmit",
}

// ================================================================== //

export enum KeyType {
    server_initial_secret = "server_initial_secret",
    client_initial_secret = "client_initial_secret",

    server_handshake_secret = "server_handshake_secret",
    client_handshake_secret = "client_handshake_secret",

    server_0rtt_secret = "server_0rtt_secret",
    client_0rtt_secret = "client_0rtt_secret",

    server_1rtt_secret = "server_1rtt_secret",
    client_1rtt_secret = "client_1rtt_secret",
}

// ================================================================== //
// Data Interfaces for QLog Events
// ================================================================== //

export type EventData = IEventServerListening | IEventConnectionStarted | IEventConnectionIDUpdated | IEventSpinBitUpdated | IEventConnectionStateUpdated |
                        IEventKeyUpdated | IEventKeyRetired |
                        IEventTransportParametersSet | IEventDatagramsReceived | IEventDatagramsSent | IEventDatagramDropped | IEventPacketReceived | IEventPacketSent | IEventPacketDropped | IEventPacketBuffered | IEventStreamStateUpdated | IEventFramesProcessed |
                        IEventRecoveryParametersSet | IEventMetricsUpdated | IEventCongestionStateUpdated | IEventLossTimerSet | IEventLossTimerExpired | IEventPacketLost | IEventMarkedForRetransmit |
                        HTTP3EventData | 
                        QPACKEventData | 
                        GenericEventData ;

// ================================================================== //
// CONNECTIVITY

export interface IEventServerListening {
    ip_v4?: string,
    ip_v6?: string,
    port_v4: number,
    port_v6: number,

    quic_versions?: Array<string>,
    alpn_values?: Array<string>,

    stateless_reset_required?:boolean
}

export interface IEventConnectionStarted {
    ip_version: string,
    src_ip: string,
    dst_ip: string,

    protocol?: string,
    src_port: number,
    dst_port: number,

    quic_version?: string,
    src_cid?: string,
    dst_cid?: string
}

export interface IEventConnectionIDUpdated {
    src_old?: string,
    src_new?: string,

    dst_old?: string,
    dst_new?: string
}

export interface IEventSpinBitUpdated {
    state: boolean
}

export interface IEventConnectionStateUpdated {
    old?:ConnectionState,
    new:ConnectionState
}

export enum ConnectionState {
    attempted = "attempted",
    reset = "reset",
    handshake = "handshake",
    active = "active",
    keepalive = "keepalive",
    draining = "draining",
    closed = "closed",
}

// ================================================================== //
// SECURITY

export interface IEventKeyUpdated {
    key_type: KeyType,
    old?: string,
    new: string,
    generation?: number
}

export interface IEventKeyRetired {
    key_type: KeyType,
    key: string,
    generation?: number
}


// ================================================================== //
// TRANSPORT

export interface IEventTransportParametersSet {
    owner?:"local" | "remote",

    resumption_allowed?:boolean, // valid session ticket was received
    early_data_enabled?:boolean, // early data extension was enabled on the TLS layer
    alpn?:string,
    version?:string, // hex (e.g., 0x)
    tls_cipher?:string, // (e.g., AES_128_GCM_SHA256)

    // transport parameters from the TLS layer:
    original_connection_id?:string, // hex
    stateless_reset_token?:string, // hex
    disable_active_migration?:boolean,

    idle_timeout?:number,
    max_packet_size?:number,
    ack_delay_exponent?:number,
    max_ack_delay?:number,
    active_connection_id_limit?:number,

    initial_max_data?:string,
    initial_max_stream_data_bidi_local?:string,
    initial_max_stream_data_bidi_remote?:string,
    initial_max_stream_data_uni?:string,
    initial_max_streams_bidi?:string,
    initial_max_streams_uni?:string,

    preferred_address?:IPreferredAddress
}

export interface IPreferredAddress {
    ip_v4:string,
    ip_v6:string,

    port_v4:string,
    port_v6:string,

    connection_id:string,
    stateless_reset_token:string
}

export interface IEventDatagramsReceived {
    count?: number,
    byte_length?:number
}

export interface IEventDatagramsSent {
    count?: number,
    byte_length?:number
}

export interface IEventDatagramDropped {
    byte_length?:number
}

// this is not really specified in the spec
// it represents shared fields between IEventPacketSent and IEventPacketReceived
// (which are 100% the same at the time of writing)
// so it's easier to handle both types of events in the same way (which is often needed)
export interface IEventPacket {
    header: IPacketHeader,
    frames?: Array<QuicFrame>,

    is_coalesced?:boolean,

    raw?:IRawInfo
}

export interface IEventPacketReceived {
    header: IPacketHeader,
    frames?: Array<QuicFrame>,

    is_coalesced?:boolean,

    raw?:IRawInfo
}

export interface IEventPacketSent {
    header: IPacketHeader,
    frames?: Array<QuicFrame>

    is_coalesced?:boolean,

    raw?:IRawInfo
}

export interface IEventPacketDropped {
    header?:IPacketHeader,

    raw?:IRawInfo, // hex encoded
}

export interface IEventPacketBuffered {
    header: IPacketHeader,
    
    raw?:IRawInfo
}

export enum PacketType {
    initial = "initial",
    handshake = "handshake",
    zerortt = "0RTT",
    onertt = "1RTT",
    retry = "retry",
    version_negotiation = "version_negotiation",
    stateless_reset = "stateless_reset",
    unknown = "unknown",
}

export interface IEventStreamStateUpdated {
    stream_id:string,
    stream_type?:"unidirectional"|"bidirectional", // mainly useful when opening the stream

    old?:StreamState,
    new:StreamState,

    stream_side?:"sending"|"receiving"
}

export enum StreamState {
    // bidirectional stream states, draft-23 3.4.
    idle,
    open,
    half_closed_local,
    half_closed_remote,
    closed,

    // sending-side stream states, draft-23 3.1.
    ready,
    send,
    data_sent,
    reset_sent,
    reset_received,

    // receive-side stream states, draft-23 3.2.
    receive,
    size_known,
    data_read,
    reset_read,

    // both-side states
    data_received,

    // qlog-defined
    destroyed, // memory actually freed
}

export interface IEventFramesProcessed {
    frames?: Array<QuicFrame>
}

// ================================================================== //
// RECOVERY

export interface IEventRecoveryParametersSet {
    // Loss detection, see recovery draft-23, Appendix A.2
    reordering_threshold?:number, // in amount of packets
    time_threshold?:number, // as RTT multiplier
    timer_granularity?:number, // in ms or us, depending on the overarching qlog's configuration
    initial_rtt?:number, // in ms or us, depending on the overarching qlog's configuration

    // congestion control, Appendix B.1.
    max_datagram_size?:number, // in bytes // Note: this could be updated after pmtud
    initial_congestion_window?:number, // in bytes
    minimum_congestion_window?:number, // in bytes // Note: this could change when max_datagram_size changes
    loss_reduction_factor?:number,
    persistent_congestion_threshold?:number // as PTO multiplier
}

export interface IEventMetricsUpdated {
    // Loss detection, see recovery draft-23, Appendix A.3
    min_rtt?:number,
    smoothed_rtt?:number,
    latest_rtt?:number,
    rtt_variance?:number,

    max_ack_delay?:number,
    pto_count?:number,

    // Congestion control, Appendix B.2.
    congestion_window?:number, // in bytes
    bytes_in_flight?:number,

    ssthresh?:number, // in bytes

    // qlog defined
    packets_in_flight?:number, // sum of all packet number spaces
    in_recovery?:boolean, // high-level signal. For more granularity, see congestion_state_updated

    pacing_rate?:number // in bps
}

export interface IEventCongestionStateUpdated {
    old?:string,
    new:string
}

export interface IEventLossTimerSet {
    timer_type?:"ack"|"pto",
    timeout?:number
}

export interface IEventLossTimerExpired {
    timer_type?:"ack"|"pto"
}

export interface IEventPacketLost {
    header?:IPacketHeader,

    frames?:Array<QuicFrame>, // see appendix for the definitions
}

export interface IEventMarkedForRetransmit {
    frames:Array<QuicFrame>
}

// ================================================================== //
// HTTP/3

// export type HTTP3EventType = IEventH3FrameCreated | IEventH3FrameParsed | IEventH3DataMoved | IEventH3DataReceived | IEventH3DependencyUpdate;

// note: here, we use HTTP3 for clarity
// in the spec, the category is just "http"!

export type HTTP3EventData = IEventH3ParametersSet | IEventH3StreamTypeSet | IEventH3FrameCreated | IEventH3FrameParsed | IEventH3DataMoved | IEventH3PushResolved;

export enum HTTP3EventType {
    parameters_set = "parameters_set",
    stream_type_set = "stream_type_set",
    frame_created = "frame_created",
    frame_parsed = "frame_parsed",
    data_moved = "data_moved",
    datagram_received = "data_received",
    dependency_update = "dependency_update",
}

export interface IEventH3ParametersSet {
    owner?:"local" | "remote",

    max_header_list_size?:number, // from SETTINGS_MAX_HEADER_LIST_SIZE
    max_table_capacity?:number, // from SETTINGS_QPACK_MAX_TABLE_CAPACITY
    blocked_streams_count?:number, // from SETTINGS_QPACK_BLOCKED_STREAMS

    push_allowed?:boolean, // received a MAX_PUSH_ID frame with non-zero value

    // qlog-defined
    waits_for_settings?:boolean // indicates whether this implementation waits for a SETTINGS frame before processing requests
}

export interface IEventH3StreamTypeSet {
    stream_id:string,

    owner?:"local"|"remote"

    old?:H3StreamType,
    new:H3StreamType,

    associated_push_id?:number // only when new == "push"
}

export enum H3StreamType {
    data = "data", // bidirectional request-response streams
    control = "control",
    push = "push",
    reserved = "reserved",
    qpack_encode = "qpack_encode",
    qpack_decode = "qpack_decode",
}

// this is not really specified in the spec
// it represents shared fields between IEventH3FrameCreated and IEventH3FrameParsed
// (which are 100% the same at the time of writing)
// so it's easier to handle both types of events in the same way (which is sometimes needed)
export interface IEventH3Frame {
    stream_id:string,
    frame:HTTP3Frame // see appendix for the definitions,
    byte_length?:string,

    raw?:string
}

export interface IEventH3FrameCreated {
    stream_id:string,
    frame:HTTP3Frame // see appendix for the definitions,
    byte_length?:string,

    raw?:string
}

export interface IEventH3FrameParsed {
    stream_id:string,
    frame:HTTP3Frame // see appendix for the definitions,
    byte_length?:string,

    raw?:string
}

export interface IEventH3DataMoved {
    stream_id:string,
    offset?:string,
    length?:number,

    from?:"application"|"transport",
    to?:"application"|"transport",

    raw?:string // in hex
}
export interface IEventH3PushResolved {
    push_id?:number,
    stream_id?:string, // in case this is logged from a place that does not have access to the push_id

    decision:"claimed"|"abandoned"
}

// ================================================================== //
// QPACK

// export type HTTP3EventType = IEventH3FrameCreated | IEventH3FrameParsed | IEventH3DataMoved | IEventH3DataReceived | IEventH3DependencyUpdate;

// note: here, we use HTTP3 for clarity
// in the spec, the category is just "http"!


export enum QPACKEventType {
    state_updated = "state_updated",
    stream_state_updated = "stream_state_updated",
    dynamic_table_updated = "dynamic_table_updated",
    headers_encoded = "headers_encoded",
    headers_decoded = "headers_decoded",
    instruction_sent = "instruction_sent",
    instruction_received = "instruction_received",
}

export type QPACKEventData = IEventQPACKStateUpdated | IEventQPACKStreamStateUpdated | IEventQPACKDynamicTableUpdated | IEventQPACKHeadersEncoded | IEventQPACKHeadersDecoded | IEventQPACKInstructionSent | IEventQPACKInstructionReceived;

export interface IEventQPACKStateUpdated {
    owner?:"local" | "remote", // can be left for bidirectionally negotiated parameters, e.g. ALPN

    dynamic_table_capacity?:number,
    dynamic_table_size?:number, // effective current size, sum of all the entries

    known_received_count?:number,
    current_insert_count?:number
}

export interface IEventQPACKStreamStateUpdated {
    stream_id:string,

    state:"blocked"|"unblocked" // streams are assumed to start "unblocked" until they become "blocked"
}

export interface IEventQPACKDynamicTableUpdated {
    update_type:"added"|"evicted",

    entries:Array<IQPACKDynamicTableEntry>
}

export interface IQPACKDynamicTableEntry {
    index:number,
    name?:string,
    value?:string
}

export interface IEventQPACKHeadersEncoded {
    stream_id?:string,

    headers?:Array<IHTTPHeader>,

    block_prefix:IQPACKHeaderBlockPrefix,
    header_block:Array<QPACKHeaderBlockRepresentation>,

    raw?:string, // in hex
}

export interface IEventQPACKHeadersDecoded {
    stream_id?:string,

    headers?:Array<IHTTPHeader>,

    block_prefix:IQPACKHeaderBlockPrefix,
    header_block:Array<QPACKHeaderBlockRepresentation>,

    raw?:string, // in hex
}

export interface IEventQPACKInstructionSent {
    instruction:QPACKInstruction // see appendix for the definitions,
    byte_length?:string,

    raw?:string // in hex
}

export interface IEventQPACKInstructionReceived {
    instruction:QPACKInstruction // see appendix for the definitions,
    byte_length?:string,

    raw?:string // in hex
}

// ================================================================== //
// Generic

export enum GenericEventType {
    connection_error = "connection_error",
    application_error = "application_error",
    internal_error = "internal_error",
    internal_warning = "internal_warning",

    message = "message",
    marker = "marker",

}

export type GenericEventData = IEventConnectionError | IEventApplicationError | IEventInternalError | IEventInternalWarning | IEventMessage | IEventMarker;

export interface IEventConnectionError {
    code?:TransportError | CryptoError | number,
    description?:string
}

export interface IEventApplicationError {
    code?:ApplicationError | number,
    description?:string
}

export interface IEventInternalError {
    code?:number,
    description?:string
}

export interface IEventInternalWarning {
    code?:number,
    description?:string
}

export interface IEventMessage {
    message:string
}

export interface IEventMarker {
    marker_type:string,
    message?:string
}

// ================================================================== //
// Based on QUIC draft-23
// ================================================================== //

export enum QUICFrameTypeName {
    padding = "padding",
    ping = "ping",
    ack = "ack",
    reset_stream = "reset_stream",
    stop_sending = "stop_sending",
    crypto = "crypto",
    new_token = "new_token",
    stream = "stream",
    max_data = "max_data",
    max_stream_data = "max_stream_data",
    max_streams = "max_streams",
    data_blocked = "data_blocked",
    stream_data_blocked = "stream_data_blocked",
    streams_blocked = "streams_blocked",
    new_connection_id = "new_connection_id",
    retire_connection_id = "retire_connection_id",
    path_challenge = "path_challenge",
    path_response = "path_response",
    connection_close = "connection_close",
    application_close = "application_close",
    unknown_frame_type = "unknown_frame_type",
}

// TODO: potentially split in LongHeader and ShortHeader explicitly?
export interface IPacketHeader {
    packet_type: PacketType;
    packet_number: quint64;
    
    payload_length?: number;

    // only if present in the header
    // if correctly using NEW_CONNECTION_ID events,
    // dcid can be skipped for 1RTT packets
    version?: string;
    scil?: string;
    dcil?: string;
    scid?: string;
    dcid?: string;

    // Note: short vs long header is implicit through PacketType
}

export type QuicFrame = IPaddingFrame | IPingFrame | IAckFrame | IResetStreamFrame | IStopSendingFrame | ICryptoFrame | INewTokenFrame | IStreamFrame | IMaxDataFrame | IMaxStreamDataFrame | IMaxStreamsFrame | IDataBlockedFrame | IStreamDataBlockedFrame | IStreamsBlockedFrame | INewConnectionIDFrame | IRetireConnectionIDFrame | IPathChallengeFrame | IPathResponseFrame | IConnectionCloseFrame | IUnknownFrame;

export interface IPaddingFrame{
    frame_type:QUICFrameTypeName.padding;
}

export interface IPingFrame{
    frame_type:QUICFrameTypeName.ping;
}

export interface IAckFrame{
    frame_type:QUICFrameTypeName.ack;

    ack_delay?:string;

    // first number is "from": lowest packet number in interval
    // second number is "to": up to and including // highest packet number in interval
    // e.g., looks like [["1","2"],["4","5"]]
    acked_ranges?:Array<[string, string]>;

    ect1?:string;
    ect0?:string;
    ce?:string;
}

export interface IResetStreamFrame{
    frame_type:QUICFrameTypeName.reset_stream;

    stream_id:string;
    error_code:ApplicationError | number;
    final_size:string;
}

export interface IStopSendingFrame{
    frame_type:QUICFrameTypeName.stop_sending;

    stream_id:string;
    error_code:ApplicationError | number;
}

export interface ICryptoFrame{
    frame_type:QUICFrameTypeName.crypto;

    offset:string;
    length:string;
}

export interface INewTokenFrame{
    frame_type:QUICFrameTypeName.new_token,

    length:string,
    token:string,
}

export interface IStreamFrame {
    frame_type:QUICFrameTypeName.stream;

    stream_id:string;

    // These two MUST always be set
    // If not present in the Frame type, log their default values
    offset:string;
    length:string;

    // this MAY be set any time, but MUST only be set if the value is "true"
    // if absent, the value MUST be assumed to be "false"
    fin?:boolean;

    raw?:string;
}

// export interface QuicFrame {
//     type: FrameTypeName,
//     length: number
// }

export interface IMaxDataFrame{
    frame_type:QUICFrameTypeName.max_data

    maximum:string;
}

export interface IMaxStreamDataFrame{
    frame_type:QUICFrameTypeName.max_stream_data;

    stream_id:string;
    maximum:string;
}

export interface IMaxStreamsFrame{
    frame_type:QUICFrameTypeName.max_streams;

    stream_type:"bidirectional" | "unidirectional";
    maximum:string;
}

export interface IDataBlockedFrame{
    frame_type:QUICFrameTypeName.data_blocked;

    limit:string;
}

export interface IStreamDataBlockedFrame{
    frame_type:QUICFrameTypeName.stream_data_blocked;

    stream_id:string;
    limit:string;
}

export interface IStreamsBlockedFrame{
    frame_type:QUICFrameTypeName.streams_blocked;

    stream_type:"bidirectional" | "unidirectional";
    limit:string;
}

export interface INewConnectionIDFrame {
    frame_type:QUICFrameTypeName.new_connection_id;

    sequence_number:string;
    retire_prior_to:string;

    length:number;
    connection_id:string;

    reset_token:string;
}

export interface IRetireConnectionIDFrame{
    frame_type:QUICFrameTypeName.retire_connection_id;

    sequence_number:string;
}

export interface IPathChallengeFrame{
    frame_type:QUICFrameTypeName.path_challenge;

    data?:string;
}

export interface IPathResponseFrame{
    frame_type:QUICFrameTypeName.path_response;

    data?:string;
}

export enum ErrorSpace {
    transport_error = "transport_error",
    application_error = "application_error",
}

export interface IConnectionCloseFrame{
    frame_type:QUICFrameTypeName.connection_close;

    error_space:ErrorSpace;
    error_code:TransportError | ApplicationError | CryptoError | string | number;
    raw_error_code:number;
    reason:string;

    trigger_frame_type?:number; // TODO: should be more defined, but we don't have a FrameType enum atm...
}

export enum TransportError {
    no_error = "no_error",
    internal_error = "internal_error",
    server_busy = "server_busy",
    flow_control_error = "flow_control_error",
    stream_limit_error = "stream_limit_error",
    stream_state_error = "stream_state_error",
    final_size_error = "final_size_error",
    frame_encoding_error = "frame_encoding_error",
    transport_parameter_error = "transport_parameter_error",
    protocol_violation = "protocol_violation",
    invalid_migration = "invalid_migration",
    crypto_buffer_exceeded = "crypto_buffer_exceeded",
    unknown = "unknown",
}

export enum CryptoError {
    prefix = "crypto_error_",
}

export interface IUnknownFrame{
    frame_type:QUICFrameTypeName.unknown_frame_type,
    raw_frame_type:number,

    raw?:string
}


// ================================================================== //

export enum HTTP3FrameTypeName {
    data = "data",
    headers = "headers",
    cancel_push = "cancel_push",
    settings = "settings",
    push_promise = "push_promise",
    goaway = "goaway",
    max_push_id = "max_push_id",
    duplicate_push = "duplicate_push",
    reserved = "reserved",
    unknown = "unknown",
}

export type HTTP3Frame = IDataFrame | IHeadersFrame | ICancelPushFrame | ISettingsFrame | IPushPromiseFrame | IGoAwayFrame | IMaxPushIDFrame | IDuplicatePushFrame | IReservedFrame | IUnknownFrame;

export interface IDataFrame{
    frame_type:HTTP3FrameTypeName.data,

    raw?:string
}

export interface IHeadersFrame{
    frame_type:HTTP3FrameTypeName.headers,
    headers:Array<IHTTPHeader>
}

export interface IHTTPHeader {
    name:string,
    value:string
}

export interface ICancelPushFrame{
    frame_type: HTTP3FrameTypeName.cancel_push,
    push_id:string
}

export interface ISettingsFrame {
    frame_type:HTTP3FrameTypeName.settings,
    settings:Array<Setting>
}

export interface Setting{
    name:"SETTINGS_MAX_HEADER_LIST_SIZE" | "SETTINGS_NUM_PLACEHOLDERS" | string,
    value:string
}

export interface IPushPromiseFrame{
    frame_type:HTTP3FrameTypeName.push_promise,
    push_id:string,

    headers:Array<IHTTPHeader>
}

export interface IGoAwayFrame{
    frame_type:HTTP3FrameTypeName.goaway,
    stream_id:string
}

export interface IMaxPushIDFrame{
    frame_type:HTTP3FrameTypeName.max_push_id,
    push_id:string
}

export interface IDuplicatePushFrame{
    frame_type:HTTP3FrameTypeName.duplicate_push,
    push_id:string
}

export interface IReservedFrame{
    frame_type:HTTP3FrameTypeName.reserved,
}

export enum ApplicationError {
    http_no_error = "http_no_error",
    http_general_protocol_error = "http_general_protocol_error",
    http_internal_error = "http_internal_error",
    http_request_cancelled = "http_request_cancelled",
    http_request_incomplete = "http_incomplete_request",
    http_connect_error = "http_connect_error",
    http_frame_error = "http_frame_error",
    http_excessive_load = "http_excessive_load",
    http_version_fallback = "http_version_fallback",
    http_id_error = "http_id_error",
    http_stream_creation_error = "http_stream_creation_error",
    http_closed_critical_stream = "http_closed_critical_stream",
    http_early_response = "http_early_response",
    http_missing_settings = "http_missing_settings",
    http_frame_unexpected = "http_unexpected_frame",
    http_request_rejected = "http_request_rejected",
    http_settings_error = "http_settings_error",
    unknown = "unknown",

}

// ================================================================== //

export enum QPACKInstructionTypeName {
    set_dynamic_table_capacity = "set_dynamic_table_capacity",
    insert_with_name_reference = "insert_with_name_reference",
    insert_without_name_reference = "insert_without_name_reference",
    duplicate = "duplicate",
    header_acknowledgement = "header_acknowledgement",
    stream_cancellation = "stream_cancellation",
    insert_count_increment = "insert_count_increment",
}

export enum QPACKHeaderBlockPresentationTypeName {
    indexed_header = "indexed_header",
    literal_with_name = "literal_with_name",
    literal_without_name = "literal_without_name",
}

export type QPACKInstruction = IQPACKSetDynamicTableCapacityInstruction | IQPACKInsertWithNameReferenceInstruction | IQPACKInsertWithoutNameReferenceInstruction | IQPACKDuplicateInstruction | IQPACKHeaderAcknowledgementInstruction | IQPACKStreamCancellationInstruction | IQPACKInsertCountIncrementInstruction;

export interface IQPACKSetDynamicTableCapacityInstruction {
    instruction_type:QPACKInstructionTypeName.set_dynamic_table_capacity,

    capacity:number
}

export interface IQPACKInsertWithNameReferenceInstruction {
    instruction_type:QPACKInstructionTypeName.insert_with_name_reference,

    table_type:"static"|"dynamic",

    name_index:number,

    huffman_encoded_value:boolean,
    value_length:number,
    value:string
}

export interface IQPACKInsertWithoutNameReferenceInstruction {
    instruction_type:QPACKInstructionTypeName.insert_without_name_reference,

    huffman_encoded_name:boolean,
    name_length:number,
    name:string,

    huffman_encoded_value:boolean,
    value_length:number,
    value:string
}

export interface IQPACKDuplicateInstruction {
    instruction_type:QPACKInstructionTypeName.duplicate,

    index:number
}

export interface IQPACKHeaderAcknowledgementInstruction {
    instruction_type:QPACKInstructionTypeName.header_acknowledgement,

    stream_id:string
}

export interface IQPACKStreamCancellationInstruction {
    instruction_type:QPACKInstructionTypeName.stream_cancellation,

    stream_id:string
}

export interface IQPACKInsertCountIncrementInstruction {
    instruction_type:QPACKInstructionTypeName.insert_count_increment,

    increment:number
}

export type QPACKHeaderBlockRepresentation = IQPACKIndexedHeaderField | IQPACKLiteralHeaderFieldWithName | IQPACKLiteralHeaderFieldWithoutName;

export interface IQPACKIndexedHeaderField {    
    header_field_type:QPACKHeaderBlockPresentationTypeName.indexed_header,

    table_type:"static"|"dynamic", // MUST be "dynamic" if is_post_base is true
    index:number,

    is_post_base?:boolean // to represent the "indexed header field with post-base index" header field type
}

export interface IQPACKLiteralHeaderFieldWithName {
    header_field_type:QPACKHeaderBlockPresentationTypeName.literal_with_name,

    preserve_literal:boolean, // the 3rd "N" bit
    table_type:"static"|"dynamic", // MUST be "dynamic" if is_post_base is true
    name_index:number,

    huffman_encoded_value:boolean,
    value_length:number,
    value:string,

    is_post_base?:boolean; // to represent the "Literal header field with post-base name reference" header field type
}

export interface IQPACKLiteralHeaderFieldWithoutName {
    header_field_type:QPACKHeaderBlockPresentationTypeName.literal_without_name,

    preserve_literal:boolean; // the 3rd "N" bit

    huffman_encoded_name:boolean;
    name_length:number;
    name:string;

    huffman_encoded_value:boolean;
    value_length:number;
    value:string;
}

export interface IQPACKHeaderBlockPrefix {
    required_insert_count:number,
    sign_bit:boolean,
    delta_base:number
}
