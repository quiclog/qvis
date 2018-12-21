<template>
    <div class="home">
        <SequenceDiagramConfigurator :config="configGetter"/>
        <SequenceDiagramRenderer :config="configGetter"/>
    </div>
</template> 

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";

    import SequenceDiagramConfig from "./data/SequenceDiagramConfig"; 
    import SequenceDiagramConfigurator from "./SequenceDiagramConfigurator.vue";
    import SequenceDiagramRenderer from "./SequenceDiagramRenderer.vue"; 

    import ConnectionStore from "@/store/ConnectionStore";
    import ConnectionGroup from "@/data/ConnectionGroup";


    @Component({
        components: {
            SequenceDiagramConfigurator,
            SequenceDiagramRenderer,
        },
    })

    export default class SequenceDiagramContainer extends Vue {

        // We want to share some stuff between our configurator (choosing which files to show, default RTT, scaling, etc.)
        // and our actual renderer. 
        // The canonical way to do this would be via the global vuex store, but that feels very dirty to me,
        // as this is supposed to be contained for the SequenceDiagram.
        // As such, we setup a custom Config object that we share via props.
        // This is frowned upon by vue (they only want one-way data flow between parent and child)
        // but I frown upon a single global store for the full application.
        protected config:SequenceDiagramConfig = new SequenceDiagramConfig();

        // TODO: get rid of this. Is just to test if we can use $data stuff in computed getters and pass them as props while keeping reactivity
        get configGetter() {
            return this.config;
        }
    } 
</script>
