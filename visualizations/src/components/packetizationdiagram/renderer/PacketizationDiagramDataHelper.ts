import ColorHelper from '@/components/shared/helpers/ColorHelper';

export default class PacketizationDiagramDataHelper {

    public static StreamIDToColor(streamID:string, protocol:"HTTP2"|"HTTP3"):Array<string> {

        return ColorHelper.StreamIDToColor( streamID, protocol );
    }
}
