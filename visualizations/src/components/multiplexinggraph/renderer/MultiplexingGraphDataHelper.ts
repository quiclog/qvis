
export default class MultiplexingGraphDataHelper {
    
    public static isDataStream(streamID:string){
        return parseInt(streamID, 10) % 4 === 0;
    }

    public static streamIDToColor(streamID:string):Array<string> {
        const lut = MultiplexingGraphDataHelper.streamIDColorLUT;

        // colors inspired by http://artshacker.com/wp-content/uploads/2014/12/Kellys-22-colour-chart.jpg

        if ( lut.size === 0 ){

            lut.set( "0",  "#E1DA4C" ); // yellow
            lut.set( "4",  "#6B067F" ); // purple
            lut.set( "8",  "#E17426" ); // orange
            lut.set( "12", "#914ca8" ); // purple
            lut.set( "16", "#99CBDF" ); // light blue
            lut.set( "20", "#C72737" ); // red
            lut.set( "24", "#BBC585" ); // buff
            lut.set( "28", "#7D787A" ); // grey
            lut.set( "32", "#6CAD58" ); // green
            lut.set( "36", "#D580AA" ); // pink
            lut.set( "40", "#4C61B9" ); // blue
            lut.set( "44", "#D38E75" ); // yellowish pink
            lut.set( "48", "#46198C" ); // violet
            lut.set( "52", "#C8A454" ); // oker
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
