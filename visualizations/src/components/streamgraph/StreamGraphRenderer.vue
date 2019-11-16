<template>
    <div>
        <div id="stream-graph" style="width: 100%; border:5px solid #d1ecf1; min-height: 200px;">
            <svg id="stream-graph-svg">
                
            </svg>
        </div>
    </div>
</template>

<script lang="ts">
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import StreamGraphConfig from "./data/StreamGraphConfig";
    import StreamGraphD3Renderer from "./renderer/StreamGraphD3Renderer";

    @Component
    export default class StreamGraphRenderer extends Vue {
        @Prop()
        public config!: StreamGraphConfig;

        protected get connection(){
            return this.config.connections[0];
        }

        protected renderer: StreamGraphD3Renderer | undefined = undefined;

        public created(){
            this.renderer = new StreamGraphD3Renderer("stream-graph");
        }

        public mounted(){
            // mainly for when we switch away, and then back to the streamgraph
            if ( this.config && this.renderer && this.config.connections.length > 0 ) {
                this.renderer.render( this.config.connections[0] );
            }
        }

        // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // however, this feels more explicit
        @Watch('config', { immediate: true, deep: true })
        protected onConfigChanged(newConfig: StreamGraphConfig, oldConfig: StreamGraphConfig) {
            console.log("StreamGraphRenderer:onConfigChanged : ", newConfig, oldConfig);

            if ( this.renderer && newConfig.connections.length > 0 ) {
                this.renderer.render( newConfig.connections[0] );
            }
        }

    }

</script>
