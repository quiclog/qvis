import {VuexModule, Module, Mutation, Action} from 'vuex-module-decorators'
import SequenceDiagramConfig from "@/components/sequencediagram/data/SequenceDiagramConfig";
import CongestionGraphConfig from '@/components/congestiongraph/data/CongestionGraphConfig';
import StatisticsConfig from '@/components/stats/data/StatisticsConfig';
import StreamGraphConfig from '@/components/streamgraph/data/StreamGraphConfig';

@Module({name: 'configurations'})
export default class ConfigurationStore extends VuexModule {

    public congestionGraphConfig: CongestionGraphConfig = new CongestionGraphConfig();
    public sequenceDiagramConfig: SequenceDiagramConfig = new SequenceDiagramConfig();
    public statisticsConfig:      StatisticsConfig      = new StatisticsConfig();
    public streamGraphConfig:     StreamGraphConfig     = new StreamGraphConfig();
}
