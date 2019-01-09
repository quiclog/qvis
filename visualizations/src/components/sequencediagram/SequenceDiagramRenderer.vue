<template>
    <div>
        <div>ManualRTT: {{config.manualRTT}}</div>
        <div>Scale: {{config.scale}}</div>

        <div v-for="(connection, index) in connections" :key="index">
            - {{index}} : {{connection.name}} : {{connection.parent.description}}
        </div>
    </div>
</template> 

<script lang="ts">
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import SequenceDiagramConfig from "./data/SequenceDiagramConfig";

    @Component
    export default class SequenceDiagramRenderer extends Vue {
        @Prop()
        public config!: SequenceDiagramConfig;

        protected get connections(){
            return this.config.connections;
        }

        // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // however, this feels more explicit
        @Watch('config', { immediate: true, deep: true })
        protected onConfigChanged(newConfig: SequenceDiagramConfig, oldConfig: SequenceDiagramConfig) {
            console.log("Renderer:onConfigChanged : ", newConfig, oldConfig);
        }
    } 

</script>