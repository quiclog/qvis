export interface PacketizationRange {
    start:number,
    size:number,

    isPayload:boolean,
    contentType:string,

    index:number,
    lowerLayerIndex:number, // for easier correlation with lower layer ranges

    color:string,

    rawPacket:any, // the raw qlog event
    extra:any // extra info needed to stringify-this 
}

export interface PacketizationLane {
    name:string, // showed next to the lane
    rangeToString:(r:PacketizationRange) => string, // used when hovering over a range to show additional information

    ranges:Array<PacketizationRange> // the actual ranges to be drawn in the lane
}


export interface LightweightRange {
    start: number,
    size: number
}

export class PacketizationPreprocessor {

    public static extractRanges(ranges:Array<LightweightRange>, size:number) {
        const output:Array<LightweightRange> = new Array<LightweightRange>();

        let remainingLength = size;

        if ( size === 0 ) {
            console.warn("Trying to extract ranges for size 0... potential error? Skipping...");

            return output;
        }

        while ( ranges.length > 0 ) {
            const range = ranges.shift();

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

                output.push( range! );
            }

            if ( range!.size < 0 ) { // sanity check
                console.error("PacketizationDiagram:extractRanges : Negative size after extracting ranges! Should not happen!", range!.size, range, ranges);
            }

            remainingLength -= range!.size;

            if ( remainingLength < 0 ) { // sanity check
                alert("Remaining length < 0, CANNOT HAPPEN!");
                break;
            }

            if ( remainingLength === 0 ) {
                break;
            }
        }

        if ( remainingLength !== 0 ) {
            alert("Trying to fill payloadranges that aren't there! " + remainingLength);
        }

        return output;
    }
}
