<template>
    <div>
        <!-- <div>ManualRTT: {{config.manualRTT}}</div>
        <div>Scale: {{config.scale}}</div> -->

        <div id="sequence-diagram" style="width: 100%; border:5px solid #cce5ff; min-height: 200px;">
            <svg id="sequence-diagram-svg">
                
            </svg>
        </div>
    </div>
</template> 

<style>
    #sequence-diagram-svg text.timestamp {
        font-size: 11px;
    }
</style> 

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

        protected renderer: SequenceDiagramD3Renderer | undefined = undefined;

        public created(){
            this.renderer = new SequenceDiagramD3Renderer("sequence-diagram", "sequence-diagram-svg");
            // this.renderer = new SequenceDiagramCanvasRenderer("sequence-diagram");
        }

        public mounted(){
            // mainly for when we switch away, and then back to the sequenceDiagram
            if ( this.config && this.renderer ) {
                this.renderer.render( this.config.connections );
            }
        }

        // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // however, this feels more explicit
        @Watch('config', { immediate: true, deep: true })
        protected async onConfigChanged(newConfig: SequenceDiagramConfig, oldConfig: SequenceDiagramConfig) {
            console.log("SequenceDiagramRenderer:onConfigChanged : ", newConfig, oldConfig);

            if ( this.renderer ) {

                // Because of the Vue reactivity, we come into this function multiple times but we just want to do the first
                // so the .rendering var helps deal with that
                // TODO: fix this OR bring this logic into this component, rather than on the renderer
                if ( !this.renderer.rendering ){

                    if ( newConfig.connections && newConfig.connections[0].getEvents().length > 10000 ){
                        Vue.notify({
                            group: "default",
                            title: "Trace might take long to render",
                            type: "warn",
                            text: "Some large traces can take a long time to render. Please be patient.",
                        });

                        // give time to show the warning
                        await new Promise( (resolve) => setTimeout(resolve, 200));
                    }

                    this.renderer.render( newConfig.connections ).then( (rendered) => {

                        if ( !rendered ) {
                            Vue.notify({
                                group: "default",
                                title: "Trace could not be rendered",
                                type: "error",
                                text: "This trace could not be rendered. There could be an error or a previous file was still rendering.<br/>See the JavaScript devtools for more information.",
                            });
                        }
                    });
                }
            }
        }

    } 

</script>