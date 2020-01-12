<template>
    <b-container fluid>
        {{(connection !== undefined) ? connection.parent.filename + " : " + connection.getLongName() : ""}}
        <b-row v-if="showwaterfall" style="height: 165px;" align-v="center">
            <b-col cols="1">
                Waterfall
            </b-col>
            <b-col cols="11">
                <div :id="id_waterfall" style="width: 100%;">
                </div>
            </b-col>
        </b-row>
        <b-row style="height: 5px;">
        </b-row>
        <b-row style="height: 70px; border: 1px solid red; display: none;" align-v="center">
            <b-col cols="1">
                Simulated FIFO order
            </b-col>
            <b-col cols="11">
                <div :id="id_fifo" style="width: 100%;">
                </div>
            </b-col>
        </b-row>
        <b-row style="height: 5px;">
        </b-row>
        <b-row style="height: 110px;" align-v="center">
            <b-col cols="1">
                Multiplexed data flow
            </b-col>
            <b-col cols="11">
                <div :id="id_data" style="width: 100%;">
                </div>
            </b-col>
        </b-row>
        <b-row v-if="showbyteranges" style="height: 520px;" align-v="center">
        <!-- <b-row v-if="showbyteranges" style="height: 10020px;" align-v="center"> -->
            <b-col cols="1">
                Byterange per STREAM frame
            </b-col>
            <b-col cols="11">
                <div :id="id_byterange" style="width: 100%;">
                </div>
            </b-col>
        </b-row>
    </b-container>
</template>

<script lang="ts">
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import QlogConnection from "@/data/Connection";
    import * as qlog from '@quictools/qlog-schema';

    import MultiplexingGraphConfig from "./data/MultiplexingGraphConfig";
    import MultiplexingGraphD3SimulationRenderer from "./renderer/MultiplexingGraphD3SimulationRenderer";
    import MultiplexingGraphD3CollapsedRenderer from "./renderer/MultiplexingGraphD3CollapsedRenderer";
    import MultiplexingGraphD3WaterfallRenderer from "./renderer/MultiplexingGraphD3WaterfallRenderer";

    @Component
    export default class MultiplexingGraphCollapsedRenderer extends Vue {
        @Prop()
        public connection!: QlogConnection;

        @Prop()
        public showwaterfall!: boolean;

        @Prop()
        public showbyteranges!:boolean;

        protected waterfallRenderer!: MultiplexingGraphD3WaterfallRenderer;
        // protected fifoRenderer!: MultiplexingGraphD3SimulationRenderer;
        protected dataRenderer!: MultiplexingGraphD3CollapsedRenderer;

        protected get id_waterfall() {
            // TODO: proper GUID!
            return this.id_fifo.replace("-fifo-", "-waterfall-");
        }

        protected get id_fifo() {
            // TODO: proper GUID!
            return "multiplexing-fifo-" + Math.round((Math.random() * 100000));
        }

        protected get id_data() {
            // TODO: proper GUID!
            return this.id_fifo.replace("-fifo-", "-data-");
        }

        protected get id_byterange() {
            return this.id_fifo.replace("-fifo-", "-byterange-");
        }

        public created() {
            console.error("COLLAPSED RENDERER CREATED!");

            this.waterfallRenderer = new MultiplexingGraphD3WaterfallRenderer( this.id_waterfall );
            // this.fifoRenderer = new MultiplexingGraphD3SimulationRenderer( this.id_fifo );

            this.dataRenderer  = new MultiplexingGraphD3CollapsedRenderer( this.id_data, this.id_byterange );
        }

        public mounted() {
            // mainly for when we switch away, and then back to the streamgraph
            this.updateRenderers();
        }

        public updated() {
            this.updateRenderers();
        }

        protected updateRenderers() {

            // Using v-if to toggle some renderers. This is not frame-perfect.
            // The renderers use things like .clientWidth to size themselves, for which the toggle really has to be completed
            // So we use a timeout to make sure this has happened before (re-)rendering
            setTimeout( () => { 
                // IMPORTANT: mounted() and updated() are only called if connection changes, if we actually use the connection in the render somewhere
                // if we don't, vue's coupling doesn't happen, even though it's a prop!!
                // if you remove connection from the rendering, have to add a Watch() statement instead
                if ( this.connection !== undefined ) {
                    if ( this.showwaterfall ) {
                        this.waterfallRenderer.render ( this.connection );
                    }
                    // this.fifoRenderer.render( this.connection );
                    this.dataRenderer.render( this.connection );
                }
            }, 100 );
        }
    }

</script>
