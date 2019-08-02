<template>
    <div>
        <div>ManualRTT: {{config.manualRTT}}</div>
        <div>Scale: {{config.scale}}</div>

        <b-container fluid>
            <b-row>
                <b-col v-for="(connection, index) in connections" :key="index">
                    - {{index}} : {{connection.name}} ( {{connection.parent.description}} )
                    <div v-for="(event,index) in connection.GetEvents()" :key="index">
                        = {{index}} : {{connection.parseEvent(event).time}} {{connection.parseEvent(event).category}} {{connection.parseEvent(event).name}} {{connection.parseEvent(event).trigger}} {{(connection.parseEvent(event).data && connection.parseEvent(event).data.header) ? connection.parseEvent(event).data.header.version : ""}}
                    </div>
                </b-col>
            </b-row>
        </b-container>
    </div>
</template> 

<script lang="ts">
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import SequenceDiagramConfig from "./data/SequenceDiagramConfig";

    @Component
    export default class SequenceDiagramSimpleRenderer extends Vue {
        @Prop()
        public config!: SequenceDiagramConfig;

        protected get connections(){
            return this.config.connections;
        }

        // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // however, this feels more explicit
        @Watch('config', { immediate: true, deep: true })
        protected onConfigChanged(newConfig: SequenceDiagramConfig, oldConfig: SequenceDiagramConfig) {
            console.log("SequenceDiagramSimpleRenderer:onConfigChanged : ", newConfig, oldConfig);
        }
    } 

</script>