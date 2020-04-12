import ColorHelper from '@/components/shared/helpers/ColorHelper';

export default class MultiplexingGraphDataHelper {
    
    public static isDataStream(streamID:string){
        return parseInt(streamID, 10) % 4 === 0;
    }

    public static StreamIDToColor(streamID:string):Array<string> {

        return ColorHelper.StreamIDToColor( streamID, "HTTP3" );
    }
}
