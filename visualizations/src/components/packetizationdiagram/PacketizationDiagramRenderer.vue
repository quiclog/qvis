<template>
    <div>
        <!-- <div>ManualRTT: {{config.manualRTT}}</div>
        <div>Scale: {{config.scale}}</div> -->

        <div id="packetization-diagram-top" style="width: 100%; min-height: 200px;">
            <!-- <svg id="packetization-diagram-svg">
                
            </svg> -->
        </div>

        <div id="packetization-diagram-bottom" style="width: 100%; min-height: 200px;">
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
    import { PacketizationDirection } from "./renderer/PacketizationDiagramModels";

    @Component
    export default class PacketizationDiagramRenderer extends Vue {
        @Prop()
        public config!: PacketizationDiagramConfig;

        public eventDetail: string = '';

        protected get connections(){
            return this.config.connections;
        }

        protected rendererTop:      PacketizationDiagramD3Renderer | undefined = undefined;
        protected rendererBottom:   PacketizationDiagramD3Renderer | undefined = undefined;

        public created(){
            this.rendererTop    = new PacketizationDiagramD3Renderer("packetization-diagram-top");
            this.rendererBottom = new PacketizationDiagramD3Renderer("packetization-diagram-bottom");
        }

        public mounted(){
            // mainly for when we switch away, and then back to the PacketizationDiagram
            if ( this.config && this.rendererTop && this.rendererBottom && this.config.connections.length > 0 ) {
                this.rendererTop.render(    this.config.connections[0], PacketizationDirection.receiving ); 
                this.rendererBottom.render( this.config.connections[0], PacketizationDirection.sending ); 
            }
        }

        // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // however, this feels more explicit
        @Watch('config', { immediate: true, deep: true })
        protected async onConfigChanged(newConfig: PacketizationDiagramConfig, oldConfig: PacketizationDiagramConfig) {
            console.log("PacketizationDiagramRenderer:onConfigChanged : ", newConfig, oldConfig);

            if ( this.rendererTop && this.rendererBottom ) {

                // Because of the Vue reactivity, we come into this function multiple times but we just want to do the first
                // so the .rendering var helps deal with that
                // TODO: fix this OR bring this logic into this component, rather than on the renderer
                if ( !this.rendererTop.rendering ){

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

                    this.rendererTop.render( newConfig.connections[0], PacketizationDirection.receiving ).then( (rendered:boolean) => {

                        if ( !rendered ) {
                            Vue.notify({
                                group: "default",
                                title: "Trace could not be rendered",
                                type: "error",
                                text: "This trace could not be rendered. There could be an error or a previous file was still rendering.<br/>See the JavaScript devtools for more information.",
                            });
                        }
                    });

                    this.rendererBottom.render( newConfig.connections[0], PacketizationDirection.sending ).then( (rendered:boolean) => {

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