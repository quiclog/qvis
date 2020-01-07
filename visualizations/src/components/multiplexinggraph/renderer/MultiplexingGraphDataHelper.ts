
export default class MultiplexingGraphDataHelper {
    
    public static isDataStream(streamID:string){
        return parseInt(streamID, 10) % 4 === 0;
    }

    public static streamIDToColor(streamID:string):Array<string> {
        const lut = MultiplexingGraphDataHelper.streamIDColorLUT;

        if ( lut.size === 0 ){

            lut.set( "0",  "red" );
            lut.set( "4",  "green" );
            lut.set( "8",  "blue" );
            lut.set( "12", "pink" );
            lut.set( "16", "purple" );
            lut.set( "20", "yellow" );
            lut.set( "24", "indigo" );
            lut.set( "28", "black" );
            lut.set( "32", "grey" );
            lut.set( "36", "brown" );
            lut.set( "40", "cyan" );
            lut.set( "44", "orange" );
        }
        
        if ( lut.has(streamID) ) {
            return [ lut.get( streamID )!, "black" ];
        }
        else {
            return [ "lavenderblush", "black" ];
        }
    }

    protected static streamIDColorLUT:Map<string, string> = new Map<string, string>();
}
