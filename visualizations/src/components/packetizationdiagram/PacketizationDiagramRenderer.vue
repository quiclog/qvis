<template>
    <div>
        <!-- <div>ManualRTT: {{config.manualRTT}}</div>
        <div>Scale: {{config.scale}}</div> -->

        <div id="packetization-diagram" style="width: 100%; border:5px solid #f8d7da; min-height: 200px;">
            <!-- <svg id="packetization-diagram-svg">
                
            </svg> -->
        </div>

        <div id="packetization-packet-tooltip"></div>
    </div>
</template> 

<script lang="ts">
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import PacketizationDiagramConfig from "./data/PacketizationDiagramConfig";
    import PacketizationDiagramD3Renderer from "./renderer/PacketizationDiagramD3Renderer";

    @Component
    export default class PacketizationDiagramRenderer extends Vue {
        @Prop()
        public config!: PacketizationDiagramConfig;

        public eventDetail: string = '';

        protected get connections(){
            return this.config.connections;
        }

        protected renderer: PacketizationDiagramD3Renderer | undefined = undefined;

        public created(){
            this.renderer = new PacketizationDiagramD3Renderer("packetization-diagram");
        }

        public mounted(){
            // mainly for when we switch away, and then back to the PacketizationDiagram
            if ( this.config && this.renderer && this.config.connections.length > 0 ) {
                this.renderer.render( this.config.connections[0], this.config.collapsed );
            }
        }

        // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // however, this feels more explicit
        @Watch('config', { immediate: true, deep: true })
        protected async onConfigChanged(newConfig: PacketizationDiagramConfig, oldConfig: PacketizationDiagramConfig) {
            console.log("PacketizationDiagramRenderer:onConfigChanged : ", newConfig, oldConfig);

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

                    this.renderer.render( newConfig.connections[0], newConfig.collapsed ).then( (rendered:boolean) => {

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