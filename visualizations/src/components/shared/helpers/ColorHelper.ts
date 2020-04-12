export default class ColorHelper {

    public static StreamIDToColor(streamID:string, protocol:"HTTP2"|"HTTP3"):Array<string> {

        let lut;
        if ( protocol === "HTTP2" ) {
            lut = ColorHelper.H2streamIDColorLUT;
        }
        else {
            lut = ColorHelper.H3streamIDColorLUT;
        }

        // colors inspired by http://artshacker.com/wp-content/uploads/2014/12/Kellys-22-colour-chart.jpg

        if ( protocol === "HTTP2" ) {
            if ( lut.size === 0 ){
                lut.set( "0",  "#FF0000" ); // bright red
                lut.set( "1",  "#E1DA4C" ); // yellow
                lut.set( "3",  "#6B067F" ); // purple
                lut.set( "5",  "#E17426" ); // orange
                lut.set( "7", "#914ca8" ); // purple
                lut.set( "9", "#99CBDF" ); // light blue
                lut.set( "11", "#C72737" ); // red
                lut.set( "13", "#BBC585" ); // buff
                lut.set( "15", "#7D787A" ); // grey
                lut.set( "17", "#6CAD58" ); // green
                lut.set( "19", "#D580AA" ); // pink
                lut.set( "21", "#4C61B9" ); // blue
                lut.set( "23", "#D38E75" ); // yellowish pink
                lut.set( "25", "#46198C" ); // violet
                lut.set( "27", "#C8A454" ); // oker
            }
            
            if ( lut.has(streamID) ) {
                return [ lut.get( streamID )!, "black" ];
            }
            else {
                let streamIDnumber = parseInt( streamID, 10 );

                if ( streamIDnumber > 27 ) {
                    streamIDnumber = streamIDnumber % 28;
                }

                if ( lut.has("" + streamIDnumber ) ) {
                    return [ lut.get( "" + streamIDnumber )!, "black" ];
                }
                else {
                    return [ "lavenderblush", "black" ]; 
                }
            }
        }
        else {
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
                let streamIDnumber = parseInt( streamID, 10 );

                if ( streamIDnumber > 52 ) {
                    streamIDnumber = streamIDnumber % 56;
                }

                if ( lut.has("" + streamIDnumber ) ) {
                    return [ lut.get( "" + streamIDnumber )!, "black" ];
                }
                else {
                    return [ "lavenderblush", "black" ]; 
                }
            }
        }
    }

    protected static H2streamIDColorLUT:Map<string, string> = new Map<string, string>();
    protected static H3streamIDColorLUT:Map<string, string> = new Map<string, string>();
}
