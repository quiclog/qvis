<template>
    <div class="home">
        <SequenceDiagramConfigurator :config="config"/>
        <SequenceDiagramRenderer :config="config"/>
        <!--<SequenceDiagramSimpleRenderer :config="config"/>-->
    </div>
</template> 

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";

    import SequenceDiagramConfig from "./data/SequenceDiagramConfig"; 
    import SequenceDiagramConfigurator from "./SequenceDiagramConfigurator.vue";
    import SequenceDiagramRenderer from "./SequenceDiagramRenderer.vue"; 
    import SequenceDiagramSimpleRenderer from "./SequenceDiagramSimpleRenderer.vue"; 

    import ConfigurationStore from "@/store/ConfigurationStore";
    import ConnectionGroup from "@/data/ConnectionGroup";


    @Component({
        components: {
            SequenceDiagramConfigurator,
            SequenceDiagramRenderer,
            SequenceDiagramSimpleRenderer,
        },
    })

    export default class SequenceDiagramContainer extends Vue {

        // We want to share some stuff between our configurator (choosing which files to show, default RTT, scaling, etc.)
        // and our actual renderer. 
        // The canonical way to do this would be to put everything on the vuex store 
        // and just have the components access the store directly.
        // However, that's a bit dirty, so instead this top-level component fetches the stored state 
        // and distributes it over the children, who need not know about the vuex store 
        protected store:ConfigurationStore = getModule(ConfigurationStore, this.$store);
        protected config:SequenceDiagramConfig = this.store.sequenceDiagramConfig;

        // TODO: get rid of this. Is just to test if we can use $data stuff in computed getters and pass them as props while keeping reactivity
        // get configGetter() {
        //    return this.config;
        // }
    } 
</script>
