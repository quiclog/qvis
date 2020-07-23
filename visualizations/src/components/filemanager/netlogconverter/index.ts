import * as fs from 'fs';
import * as _ from 'lodash';

class Netlog {
    qlog: Qlog;
    events: [object];
    event_types: object;
    source_types: object;
    phases: object;
    start_time: number;

    constructor(filename: string, qlog: Qlog) {
        const buf = fs.readFileSync(filename, { encoding: 'utf-8' });
        const output = JSON.parse(buf);
        const constants = output['constants'];

        this.events = output['events'];
        this.event_types = _.invert(constants['logEventTypes']);
        this.source_types = _.invert(constants['logSourceType']);
        this.phases = _.invert(constants['logEventPhase']);
        this.start_time = null;
    }

    parse_events() {
        this.events.forEach(event => {
            this.parse_event(event);
        });
    }

    parse_event(event: object) {
        // source
        const { source_id, source_type } = this.parse_event_source(event['source'])

        if (source_type !== 'QUIC_SESSION') {
            return;
        }

        // time in ms
        let time: number = +event['time'];

        if (this.start_time === null) {
            this.start_time = time;
            time = 0;
        } else {
            time = time - this.start_time;
        }

        // event_type in string
        const event_type = this.event_types[event['type']];

        // phase in string
        const phase = this.phases[event['phase']];

        // custom params
        const params = event['params'];

        if (params !== null) {
            this.parse_event_params(event_type, params);
        }
    }

    parse_event_source(source: object) {
        return {
            source_id: source['id'],
            source_type: this.source_types[source['type']]
        }
    }

    parse_event_params(event_type: string, params: object) {
        switch (event_type) {
            case 'QUIC_SESSION':
                break;
            case 'QUIC_SESSION_TRANSPORT_PARAMETERS_SENT':
                break;
            case 'QUIC_SESSION_CRYPTO_FRAME_SENT':
                break;
            case 'QUIC_SESSION_PACKET_SENT':
                break;
            case 'QUIC_SESSION_PADDING_FRAME_SENT':
                break;
            case 'QUIC_SESSION_COALESCED_PACKET_SENT':
                break;
            case 'QUIC_SESSION_ACK_FRAME_SENT':
                break;
            case 'QUIC_SESSION_STREAM_FRAME_SENT':
                break;
            case 'QUIC_SESSION_CONNECTION_CLOSE_FRAME_SENT':
                break;
            case 'QUIC_SESSION_PACKET_RECEIVED':
                break;
            case 'QUIC_SESSION_UNAUTHENTICATED_PACKET_HEADER_RECEIVED':
                break;
            case 'QUIC_SESSION_ACK_FRAME_RECEIVED':
                break;
            case 'QUIC_SESSION_CRYPTO_FRAME_RECEIVED':
                break;
            case 'QUIC_SESSION_PADDING_FRAME_RECEIVED':
                break;
            case 'QUIC_SESSION_STREAM_FRAME_RECEIVED':
                break;
            case 'QUIC_SESSION_CLOSED':
                break;
            case 'QUIC_SESSION_BUFFERED_UNDECRYPTABLE_PACKET':
                break;
            case 'QUIC_SESSION_ATTEMPTING_TO_PROCESS_UNDECRYPTABLE_PACKET':
                break;
            default:
                console.log(event_type);
                break;
        }
    }
}

class Qlog {
    filename: string;
    events: [object];

    constructor(filename: string) {
        this.filename = filename;
    }

    output_to_json() {

    }
}

const netlog2qlog = (input: string, output: string) => {
    const qlog = new Qlog(output);
    const netlog = new Netlog(input, qlog);
    netlog.parse_events();
}

netlog2qlog('netlog.json', 'qlog.json');

