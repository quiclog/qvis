import * as qlog from '@/data/QlogSchema';

export enum PacketizationDirection {
    sending,
    receiving,
}

export interface PacketizationRange {
    start:number,
    size:number,

    isPayload:boolean,
    contentType?:string, // e.g., header frame, payload frame, application record, ...

    index:number,
    lowerLayerIndex:number, // for easier correlation with lower layer ranges

    color:string,

    rawPacket?:any, // the raw qlog event
    extra?:any // extra info needed to stringify-this 
}

export interface PacketizationLane {
    name:string, // showed next to the lane, purely visual
    CSSClassName:string, // CSS class used for items on this lane 
    rangeToString:(r:PacketizationRange) => string, // used when hovering over a range to show additional information

    heightModifier?:number, // mainly to reduce the height of an individual lane

    ranges:Array<PacketizationRange>, // the actual ranges to be drawn in the lane

    max_size_local?:number,
    max_size_remote?:number,

    efficiency?:number
}


export interface LightweightRange {
    start: number,
    size: number
}

export class PacketizationPreprocessor {

    // FIXME: refactor this into a general HTTP3 protocol helper class 
    public static H3FrameTypeToNumber(frame:any) {
        /* // draft-27
                +--------------+-------+---------------+
                 | Frame Type   | Value | Specification |
                 +==============+=======+===============+
                 | DATA         |  0x0  | Section 7.2.1 |
                 +--------------+-------+---------------+
                 | HEADERS      |  0x1  | Section 7.2.2 |
                 +--------------+-------+---------------+
                 | Reserved     |  0x2  | N/A           |
                 +--------------+-------+---------------+
                 | CANCEL_PUSH  |  0x3  | Section 7.2.3 |
                 +--------------+-------+---------------+
                 | SETTINGS     |  0x4  | Section 7.2.4 |
                 +--------------+-------+---------------+
                 | PUSH_PROMISE |  0x5  | Section 7.2.5 |
                 +--------------+-------+---------------+
                 | Reserved     |  0x6  | N/A           |
                 +--------------+-------+---------------+
                 | GOAWAY       |  0x7  | Section 7.2.6 |
                 +--------------+-------+---------------+
                 | Reserved     |  0x8  | N/A           |
                 +--------------+-------+---------------+
                 | Reserved     |  0x9  | N/A           |
                 +--------------+-------+---------------+
                 | MAX_PUSH_ID  |  0xD  | Section 7.2.7 |
                 +--------------+-------+---------------+
        */
        switch ( frame.frame_type ) {
            case qlog.HTTP3FrameTypeName.data:
                return 0x00;
                break;
            case qlog.HTTP3FrameTypeName.headers:
                return 0x01;
                break;
            case qlog.HTTP3FrameTypeName.reserved:
                return 0x02;
                break;
            case qlog.HTTP3FrameTypeName.cancel_push:
                return 0x03;
                break;
            case qlog.HTTP3FrameTypeName.settings:
                return 0x04;
                break;
            case qlog.HTTP3FrameTypeName.push_promise:
                return 0x05;
                break;
            case qlog.HTTP3FrameTypeName.goaway:
                return 0x07;
                break;
            case qlog.HTTP3FrameTypeName.max_push_id:
                return 0x0D;
                break;
            case qlog.HTTP3FrameTypeName.unknown:
                return frame.raw_frame_type;
                break;
            default:
                return 0x00;
                break;
        }
    }

    // FIXME: refactor this into a general QUIC protocol helper class 
    public static VLIELength(input:number) {
        /*
        +------+--------+-------------+-----------------------+
          | 2Bit | Length | Usable Bits | Range                 |
          +======+========+=============+=======================+
          | 00   | 1      | 6           | 0-63                  |
          +------+--------+-------------+-----------------------+
          | 01   | 2      | 14          | 0-16383               |
          +------+--------+-------------+-----------------------+
          | 10   | 4      | 30          | 0-1073741823          |
          +------+--------+-------------+-----------------------+
          | 11   | 8      | 62          | 0-4611686018427387903 |
          +------+--------+-------------+-----------------------+
        */

        if ( input <= 63 ) {
            return 1;
        }
        if ( input <= 16383 ) {
            return 2;
        }
        if ( input <= 1073741823 ) {
            return 4;
        }

        return 8;
    }

    public static extractRanges(ranges:Array<LightweightRange>, size:number) {
        const output:Array<LightweightRange> = new Array<LightweightRange>();

        let remainingLength = size;

        if ( size === 0 ) {
            console.warn("Trying to extract ranges for size 0... potential error? Skipping...");

            return output;
        }

        while ( ranges.length > 0 ) {
            const range = ranges.shift();

            // console.log("Considering range", range, remainingLength);

            // either we consume the range, or we need to split it
            // the last option should only happen once at maximum, at the very end of this run
            if ( range!.start + range!.size <= range!.start + remainingLength ) {
                // full range is consumed
                // console.log("Consuming range!", range!.start, range!.size, remainingLength );
                output.push( range! );
            }
            else {
                // console.log("Splitting range!", range!.start, range!.size, remainingLength );

                if ( size === 5 && remainingLength < 5 ) { // header is being split... bad for performance
                    console.warn("Splitting a header range... server is being bad/naive?", size);
                }

                // range needs to be split
                ranges.unshift( {start: range!.start + remainingLength, size: range!.size - remainingLength} );
                range!.size = remainingLength; // this struct isn't added back to the "ranges" array, so can safely change it for use below

                // console.log("We split the range", range);

                output.push( range! );
            }

            if ( range!.size < 0 ) { // sanity check
                console.error("PacketizationDiagram:extractRanges : Negative size after extracting ranges! Should not happen!", range!.size, range, ranges);
            }

            remainingLength -= range!.size;

            // console.log("Remaining length", remainingLength, range!.size);

            if ( remainingLength < 0 ) { // sanity check
                alert("Remaining length < 0, CANNOT HAPPEN! " + remainingLength); // FIXME: make alert
                break;
            }

            if ( remainingLength === 0 ) {
                break;
            }
        }

        if ( remainingLength !== 0 ) {
            alert("Trying to fill payloadranges that aren't there! " + remainingLength); // FIXME: make alert
        }

        return output;
    }
}
