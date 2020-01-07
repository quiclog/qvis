<template>
    <b-container fluid style="height: 240px;">
        {{(connection !== undefined) ? connection.getLongName() : ""}}
        <b-row style="height: 70px; border: 1px solid red;" align-v="center">
            <b-col cols="1">
                Request send order
            </b-col>
            <b-col cols="11">
                <div :id="id_requests" style="width: 100%;">
                </div>
            </b-col>
        </b-row>
        <b-row style="height: 5px;">
        </b-row>
        <b-row style="height: 70px; border: 1px solid blue;" align-v="center">
            <b-col cols="1">
                Multiplexed data flow
            </b-col>
            <b-col cols="11">
                <div :id="id_data" style="width: 100%;">
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
    import MultiplexingGraphD3RequestsRenderer from "./renderer/MultiplexingGraphD3RequestsRenderer";
    import MultiplexingGraphD3CollapsedRenderer from "./renderer/MultiplexingGraphD3CollapsedRenderer";

    @Component
    export default class MultiplexingGraphCollapsedRenderer extends Vue {
        @Prop()
        public connection!: QlogConnection;

        protected requestRenderer!: MultiplexingGraphD3RequestsRenderer;
        protected dataRenderer!: MultiplexingGraphD3CollapsedRenderer;

        protected get id_requests() {
            // TODO: proper GUID!
            return "multiplexing-reqs-" + Math.round((Math.random() * 100000));
        }

        protected get id_data() {
            // TODO: proper GUID!
            return this.id_requests.replace("-reqs-", "-data-");
        }

        public created() {
            console.error("COLLAPSED RENDERER CREATED!");

            this.requestRenderer = new MultiplexingGraphD3RequestsRenderer( this.id_requests);

            this.dataRenderer  = new MultiplexingGraphD3CollapsedRenderer( this.id_data );
        }

        public mounted() {
            // mainly for when we switch away, and then back to the streamgraph
            this.updateRenderers();
        }

        public updated() {
            this.updateRenderers();
        }

        protected updateRenderers() {
            // IMPORTANT: mounted() and updated() are only called if connection changes, if we actually use the connection in the render somewhere
            // if we don't, vue's coupling doesn't happen, even though it's a prop!!
            // if you remove connection from the rendering, have to add a Watch() statement instead
            if ( this.connection !== undefined ) {
                this.requestRenderer.render( this.connection );
                this.dataRenderer.render( this.connection );
            }
        }
    }

</script>
