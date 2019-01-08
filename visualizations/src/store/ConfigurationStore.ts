import {VuexModule, Module, Mutation, Action} from 'vuex-module-decorators'
import SequenceDiagramConfig from "@/components/sequencediagram/data/SequenceDiagramConfig";

@Module({name: 'configurations'})
export default class ConfigurationStore extends VuexModule {

    public sequenceDiagramConfig: SequenceDiagramConfig = new SequenceDiagramConfig();
    
}
