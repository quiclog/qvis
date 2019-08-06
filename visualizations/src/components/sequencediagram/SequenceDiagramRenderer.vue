<template>
    <div>
        <div>ManualRTT: {{config.manualRTT}}</div>
        <div>Scale: {{config.scale}}</div>

        <div id="sequence-diagram" style="width: 100%; border:5px solid red; min-height: 200px;">
            <svg id="sequence-diagram-svg">
                

            </svg>
        </div>
    </div>
</template> 

<script lang="ts">
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import SequenceDiagramConfig from "./data/SequenceDiagramConfig";
    import SequenceDiagramD3Renderer from "./renderer/SequenceDiagramD3Renderer";
    import SequenceDiagramCanvasRenderer from "./renderer/SequenceDiagramCanvasRenderer";

    @Component
    export default class SequenceDiagramRenderer extends Vue {
        @Prop()
        public config!: SequenceDiagramConfig;

        protected get connections(){
            return this.config.connections;
        }

        protected renderer: SequenceDiagramD3Renderer | SequenceDiagramCanvasRenderer | undefined = undefined;

        public created(){
            //this.renderer = new SequenceDiagramD3Renderer("sequence-diagram", "sequence-diagram-svg");
            this.renderer = new SequenceDiagramCanvasRenderer("sequence-diagram");
        }

        // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // however, this feels more explicit
        @Watch('config', { immediate: true, deep: true })
        protected onConfigChanged(newConfig: SequenceDiagramConfig, oldConfig: SequenceDiagramConfig) {
            console.log("SequenceDiagramRenderer:onConfigChanged : ", newConfig, oldConfig);

            if ( this.renderer ) {
                this.renderer.render( newConfig.connections );
            }
        }

    } 

</script>