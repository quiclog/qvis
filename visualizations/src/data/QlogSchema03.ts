/* tslint:disable */

// ================================================================== //
// Interface for the "current" qlog IETF drafts, as opposed to the draft-02/0.3
// format implemented in QlogSchema02.ts:
//   - draft-ietf-quic-qlog-main-schema-14 (file/event envelope)
//   - draft-ietf-quic-qlog-quic-events-13 (the "quic" namespace)
//   - draft-ietf-quic-qlog-h3-events-13   (the "http3" and "http" namespaces)
//
// The main structural differences vs. draft-02 (see QlogSchema02.ts):
//   - no qlog_version/qlog_format/configuration: a file is identified by its
//     `file_schema` URI instead (see FileSchema below)
//   - category:type (e.g. "transport:packet_sent") collapsed into a single
//     namespace per protocol (e.g. "quic:packet_sent", "http3:frame_created")
//   - `path` renamed to `tuple` (and is now just an opaque string identifier)
//   - time_format is "relative_to_epoch" / "relative_to_previous_event"
//     instead of "absolute" / "relative" / "delta"
//   - reference_time is a structured object, not a bare number/string
//
// Since qvis's renderers look events up by the *legacy* (category, name) pair
// (see QlogConnection.lookup()), EventNameMapping below maps every new
// "namespace:event_type" onto the closest legacy (category, name) pair, so
// that existing renderers keep working for events that still exist. This is
// a compatibility shim, not a spec concept: see EventNameMapping comments
// for exactly which mappings are exact renames vs. "new event, no legacy
// equivalent, filed under the closest legacy category for grouping".
// ================================================================== //

import { EventCategory, PacketType, QuicFrame, qbytes, quint64 } from './QlogSchema02';

export class Defaults {
    public static versionName: string = "main-schema-14";

    // new-draft files have no qlog_version field at all: they are identified
    // by file_schema instead (see QlogLoaderV3.fromJSON)
    public static fileSchemaAliases: Array<string> = [
        "urn:ietf:params:qlog:file:contained",
        "urn:ietf:params:qlog:file:sequential",
    ];
}

export enum FileSchema {
    contained = "urn:ietf:params:qlog:file:contained", // QlogFile : one or more traces, events inline in a `traces` array
    sequential = "urn:ietf:params:qlog:file:sequential", // QlogFileSeq : single trace, events as separate JSON-SEQ records (.sqlog)
}

// ================================================================== //
// Top-level file structure (main-schema-14, Sections 4-5)
// ================================================================== //

export interface IQlogFile {
    file_schema: string,
    serialization_format?: string,

    title?: string,
    description?: string,

    // QlogFile ("contained"): events live inline, possibly several traces
    traces?: Array<ITrace | ITraceError>,

    // QlogFileSeq ("sequential"): a single trace, no inline `events` array
    // (events arrive as separate JSON-SEQ records after this header)
    trace?: ITrace | ITraceError,
}

export interface ITraceError {
    error_description: string,
    uri?: string,

    vantage_point?: IVantagePoint,
}

export interface ITrace {
    title?: string,
    description?: string,

    common_fields?: ICommonFields,
    vantage_point?: IVantagePoint,

    event_schemas?: Array<string>,

    events: Array<IEvent>,
}

// ================================================================== //
// Vantage point / common fields / reference time (Sections 6-7)
// ================================================================== //

export interface IVantagePoint {
    name?: string,
    type: VantagePointType,
    flow?: VantagePointType, // required when type === network
}

export enum VantagePointType {
    client = "client",
    server = "server",
    network = "network",
    unknown = "unknown",
}

// TimeFormat replaces draft-02's "absolute" | "relative" | "delta"
export enum TimeFormat {
    relative_to_epoch = "relative_to_epoch", // default; combine with common_fields.reference_time
    relative_to_previous_event = "relative_to_previous_event", // each event's time is a delta vs. the previous one
}

export interface IReferenceTime {
    clock_type?: "system" | "monotonic" | string, // default "system"
    epoch: string, // RFC3339 datetime, or the literal "unknown" (MUST be "unknown" for a monotonic clock)
    wall_clock_time?: string, // RFC3339 datetime, approximate, informational only
}

// GroupID and TupleID are both just opaque strings in the new draft: the
// spec intentionally leaves their contents undefined (main-schema-14 7.2/7.3)
export type GroupID = string;
export type TupleID = string;

export interface ICommonFields {
    tuple?: TupleID,
    time_format?: TimeFormat,
    reference_time?: IReferenceTime,
    group_id?: GroupID,

    [additionalUserSpecifiedProperty: string]: any,
}

export interface ISystemInformation {
    processor_id?: number,
    process_id?: number,
    thread_id?: number,
}

// ================================================================== //
// Event (Section 7, Figure 14)
// ================================================================== //

export interface IEvent {
    time: number, // float64, milliseconds
    name: string, // "namespace:event_type", e.g. "quic:packet_sent" -- globally unique
    data: EventData,

    tuple?: TupleID, // replaces draft-02's `path`
    time_format?: TimeFormat,
    group_id?: GroupID,
    system_info?: ISystemInformation,

    [additionalUserSpecifiedProperty: string]: any,
}

// ================================================================== //
// quic-events-13 : TupleEndpointInfo (Section 8.5)
// ================================================================== //

export interface ITupleEndpointInfo {
    ip_v4?: string,
    port_v4?: number,
    ip_v6?: string,
    port_v6?: number,

    connection_ids?: Array<qbytes>,
}

// ================================================================== //
// quic-events-13 : PacketHeader (Section 8.8)
//
// Mostly compatible with QlogSchema02.IPacketHeader. Kept as its own type
// because packet_number/packet_number_length are now explicitly split out,
// and packet_type_bytes/token/length were added.
// ================================================================== //

export interface IPacketHeader03 {
    packet_type: PacketType | string,
    packet_type_bytes?: quint64, // only if packet_type === "unknown"

    packet_number?: quint64,
    packet_number_length?: number,

    spin_bit?: boolean, // 1RTT only
    key_phase?: quint64,
    key_phase_bit?: boolean, // 1RTT only

    token?: qbytes, // initial, retry
    length?: number, // initial, handshake, 0RTT

    version?: string,
    scil?: number,
    dcil?: number,
    scid?: string,
    dcid?: string,
}

export interface IRawInfo {
    length?: number,
    payload_length?: number,
    data?: qbytes,
}

// ================================================================== //
// quic-events-13 event data (Sections 4-7)
//
// Only the events that currently drive qvis's renderers (packets, frames,
// recovery/congestion metrics, keys, connection lifecycle) are typed in
// detail here. The rest fall back to the loosely-typed IGenericEventData03,
// which is enough to display them in the raw event/file-manager views.
// ================================================================== //

export interface IGenericEventData03 {
    [additionalUserSpecifiedProperty: string]: any,
}

export interface IEventConnectionStarted03 {
    local: ITupleEndpointInfo,
    remote: ITupleEndpointInfo,
}

export interface IEventConnectionClosed03 {
    initiator?: "local" | "remote",
    connection_error?: string,
    application_error?: string,
    error_code?: quint64,
    internal_code?: quint64,
    reason?: string,
    trigger?: string,
}

export interface IEventPacketSent03 {
    header: IPacketHeader03,
    frames?: Array<QuicFrame>,
    stateless_reset_token?: qbytes,
    supported_versions?: Array<string>,
    raw?: IRawInfo,
    datagram_id?: number,
    is_mtu_probe_packet?: boolean,
    trigger?: string,
}

export interface IEventPacketReceived03 {
    header: IPacketHeader03,
    frames?: Array<QuicFrame>,
    stateless_reset_token?: qbytes,
    supported_versions?: Array<string>,
    raw?: IRawInfo,
    datagram_id?: number,
    trigger?: string,
}

export interface IEventPacketLost03 {
    header?: IPacketHeader03,
    frames?: Array<QuicFrame>,
    is_mtu_probe_packet?: boolean,
    trigger?: string,
}

export interface IEventPacketDropped03 {
    header?: IPacketHeader03,
    raw?: IRawInfo,
    datagram_id?: number,
    details?: string,
    trigger?: string,
}

export interface IEventRecoveryMetricsUpdated03 {
    min_rtt?: number,
    smoothed_rtt?: number,
    latest_rtt?: number,
    rtt_variance?: number,

    pto_count?: number,

    congestion_window?: quint64,
    bytes_in_flight?: quint64,
    ssthresh?: quint64,
    packets_in_flight?: quint64,

    pacing_rate?: quint64, // bits per second
}

export interface IEventCongestionStateUpdated03 {
    old?: string,
    new: string,
    trigger?: string,
}

export interface IEventKeyUpdated03 {
    key_type: string,
    old?: qbytes,
    new?: qbytes,
    key_phase?: quint64,
    trigger?: string,
}

export interface IEventKeyDiscarded03 {
    key_type: string,
    key?: qbytes,
    key_phase?: quint64,
    trigger?: string,
}

export type EventData =
    IEventConnectionStarted03 | IEventConnectionClosed03 |
    IEventPacketSent03 | IEventPacketReceived03 | IEventPacketLost03 | IEventPacketDropped03 |
    IEventRecoveryMetricsUpdated03 | IEventCongestionStateUpdated03 |
    IEventKeyUpdated03 | IEventKeyDiscarded03 |
    IGenericEventData03;

// ================================================================== //
// EventNameMapping: "namespace:event_type" -> legacy (category, name)
//
// This is the compatibility shim that lets existing renderers (which call
// QlogConnection.lookup(EventCategory.x, SomeEventType.y)) keep working
// unmodified against new-draft traces, for every event that has a clear
// legacy equivalent. Renamed-with-no-behavior-change events map onto their
// old name. Genuinely new events (no draft-02 equivalent) are kept under
// their closest legacy category, with their new-draft name, purely so they
// group sensibly in the raw per-category event views; nothing in qvis looks
// those up by a legacy enum value (there isn't one), so this is just for
// consistency with the rest of this table.
// ================================================================== //

export interface ILegacyEventNameMapping {
    category: string,
    name: string,
}

export const EventNameMapping: { [namespacedEventType: string]: ILegacyEventNameMapping } = {
    // --- quic namespace : connectivity -------------------------------- //
    "quic:server_listening":            { category: EventCategory.connectivity, name: "server_listening" },
    "quic:connection_started":          { category: EventCategory.connectivity, name: "connection_started" },
    "quic:connection_closed":           { category: EventCategory.connectivity, name: "connection_closed" }, // new in this draft
    "quic:connection_id_updated":       { category: EventCategory.connectivity, name: "connection_id_updated" },
    "quic:spin_bit_updated":            { category: EventCategory.connectivity, name: "spin_bit_updated" },
    "quic:connection_state_updated":    { category: EventCategory.connectivity, name: "connection_state_updated" },
    "quic:tuple_assigned":              { category: EventCategory.connectivity, name: "tuple_assigned" }, // new
    "quic:mtu_updated":                 { category: EventCategory.connectivity, name: "mtu_updated" }, // new

    // --- quic namespace : transport ------------------------------------ //
    "quic:version_information":             { category: EventCategory.transport, name: "version_information" }, // new
    "quic:alpn_information":                 { category: EventCategory.transport, name: "alpn_information" }, // new
    "quic:parameters_set":                   { category: EventCategory.transport, name: "parameters_set" },
    "quic:parameters_restored":              { category: EventCategory.transport, name: "parameters_restored" }, // new
    "quic:packet_sent":                      { category: EventCategory.transport, name: "packet_sent" },
    "quic:packet_received":                  { category: EventCategory.transport, name: "packet_received" },
    "quic:packet_dropped":                   { category: EventCategory.transport, name: "packet_dropped" },
    "quic:packet_buffered":                  { category: EventCategory.transport, name: "packet_buffered" },
    "quic:packets_acked":                    { category: EventCategory.transport, name: "packets_acked" }, // new
    "quic:udp_datagrams_sent":               { category: EventCategory.transport, name: "datagrams_sent" }, // renamed (was datagrams_sent)
    "quic:udp_datagrams_received":           { category: EventCategory.transport, name: "datagrams_received" }, // renamed (was datagrams_received)
    "quic:udp_datagram_dropped":             { category: EventCategory.transport, name: "datagram_dropped" }, // renamed (was datagram_dropped)
    "quic:stream_state_updated":             { category: EventCategory.transport, name: "stream_state_updated" },
    "quic:frames_created":                   { category: EventCategory.transport, name: "frames_created" }, // new (packet_sent used to carry frames directly, still does)
    "quic:frames_parsed":                    { category: EventCategory.transport, name: "frames_parsed" }, // new
    "quic:frames_processed":                 { category: EventCategory.transport, name: "frames_processed" },
    "quic:stream_data_moved":                { category: EventCategory.transport, name: "stream_data_moved" }, // new
    "quic:datagram_data_moved":              { category: EventCategory.transport, name: "datagram_data_moved" }, // new
    "quic:connection_data_blocked_updated":  { category: EventCategory.transport, name: "connection_data_blocked_updated" }, // new
    "quic:stream_data_blocked_updated":      { category: EventCategory.transport, name: "stream_data_blocked_updated" }, // new
    "quic:datagram_data_blocked_updated":    { category: EventCategory.transport, name: "datagram_data_blocked_updated" }, // new
    "quic:migration_state_updated":          { category: EventCategory.transport, name: "migration_state_updated" }, // new
    "quic:timer_updated":                    { category: EventCategory.transport, name: "timer_updated" }, // new

    // --- quic namespace : security -------------------------------------- //
    "quic:key_updated":                 { category: EventCategory.security, name: "key_updated" },
    "quic:key_discarded":               { category: EventCategory.security, name: "key_retired" }, // renamed (was key_retired)

    // --- quic namespace : recovery --------------------------------------- //
    "quic:recovery_parameters_set":     { category: EventCategory.recovery, name: "parameters_set" },
    "quic:recovery_metrics_updated":    { category: EventCategory.recovery, name: "metrics_updated" },
    "quic:congestion_state_updated":    { category: EventCategory.recovery, name: "congestion_state_updated" },
    "quic:packet_lost":                 { category: EventCategory.recovery, name: "packet_lost" },
    "quic:marked_for_retransmit":       { category: EventCategory.recovery, name: "marked_for_retransmit" },
    "quic:ecn_state_updated":           { category: EventCategory.recovery, name: "ecn_state_updated" }, // new

    // --- http3 namespace (was category "http" in draft-02) -------------- //
    "http3:parameters_set":             { category: EventCategory.http, name: "parameters_set" },
    "http3:parameters_restored":        { category: EventCategory.http, name: "parameters_restored" }, // new
    "http3:stream_type_set":            { category: EventCategory.http, name: "stream_type_set" },
    "http3:priority_updated":           { category: EventCategory.http, name: "priority_updated" }, // new scheme (Extensible Priorities), not the same as draft-02's dependency_update
    "http3:frame_created":              { category: EventCategory.http, name: "frame_created" },
    "http3:frame_parsed":               { category: EventCategory.http, name: "frame_parsed" },
    "http3:datagram_created":           { category: EventCategory.http, name: "datagram_created" }, // new
    "http3:datagram_parsed":            { category: EventCategory.http, name: "datagram_parsed" }, // new
    "http3:push_resolved":              { category: EventCategory.http, name: "push_resolved" },

    // --- http namespace : capsules (added in h3-events draft-13) -------- //
    "http:capsule_created":             { category: EventCategory.http, name: "capsule_created" }, // new
    "http:capsule_parsed":              { category: EventCategory.http, name: "capsule_parsed" }, // new

    // note: QPACK events were removed entirely from the spec (h3-events draft-05
    // onward); there is intentionally no mapping target for them anymore.
};
