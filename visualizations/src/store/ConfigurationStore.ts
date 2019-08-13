import {VuexModule, Module, Mutation, Action} from 'vuex-module-decorators'
import SequenceDiagramConfig from "@/components/sequencediagram/data/SequenceDiagramConfig";
import CongestionGraphConfig from '@/components/congestiongraph/data/CongestionGraphConfig';

@Module({name: 'configurations'})
export default class ConfigurationStore extends VuexModule {

    public sequenceDiagramConfig: SequenceDiagramConfig = new SequenceDiagramConfig();
    public congestionGraphConfig: CongestionGraphConfig = new CongestionGraphConfig();
}
