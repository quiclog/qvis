<template>
    <div>
        <!-- <MultiplexingGraphCollapsedRenderer 
            style="width: 100%; border:5px solid #d1ecf1;"
            :connection="connection"
        /> -->

        <b-container fluid>
            <b-row align-v="center">
                <b-col cols="6">
                    <div id="multiplexing-stats" style="width: 100%;">

                    </div>
                </b-col>
                <b-col cols="6">
                    <div id="multiplexing-stats-streams" style="width: 100%;">

                    </div>
                </b-col>
            </b-row>
        </b-container>

        <template v-for="(connection2,index) in this.config.connections">
            <MultiplexingGraphCollapsedRenderer 
                style="width: 100%; border:5px solid #d1ecf1;"
                :key="index"
                :connection="connection2"
                :showwaterfall="config.showwaterfall"
                :showbyteranges="config.showbyteranges"
            />
        </template>

        <div id="multiplexing-packet-tooltip"></div>

    </div>
</template>

<script lang="ts">
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import MultiplexingGraphConfig from "./data/MultiplexingGraphConfig";

    import MultiplexingGraphCollapsedRenderer from "./MultiplexingGraphCollapsedRenderer.vue";

    @Component({
        components: {
            MultiplexingGraphCollapsedRenderer,
        },
    })
    export default class MultiplexingGraphRenderer extends Vue {
        @Prop()
        public config!: MultiplexingGraphConfig;

        protected get connection() {
            return this.config.connections[0];
        }

        // protected timelineRenderer!: StreamGraphD3Renderer;
        // protected collapsedRenderer!: StreamGraphD3CollapsedRenderer;

        public created(){
            // this.timelineRenderer = new StreamGraphD3Renderer("stream-graph");
            // this.collapsedRenderer = new StreamGraphD3CollapsedRenderer("stream-graph-collapsed");
        }

        // public mounted(){
        //     // mainly for when we switch away, and then back to the streamgraph
        //     if ( this.config && this.getRenderer() && this.config.connections.length > 0 ) {
        //         // this.getRenderer().render( this.config.connections[0] );
        //     }
        // }

        // public updated() {
        //     console.log("StreamGraphRenderer updated");
        // }

        // protected getRenderer() {
        //     if (this.config.collapsed) {
        //         return this.collapsedRenderer;
        //     }
        //     else {
        //         return this.timelineRenderer;
        //     }
        // }

        // // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // // however, this feels more explicit
        // @Watch('config', { immediate: true, deep: true })
        // protected onConfigChanged(newConfig: StreamGraphConfig, oldConfig: StreamGraphConfig) {
        //     console.log("StreamGraphRenderer:onConfigChanged : ", newConfig, oldConfig);

        //     if ( this.getRenderer() && newConfig.connections.length > 0 ) {
        //         // need to timeout, because need to toggle the container with v-show before using it
        //         // setTimeout( () => { this.getRenderer().render( newConfig.connections[0] ) }, 100 );
        //     }
        // }

    }

</script>
