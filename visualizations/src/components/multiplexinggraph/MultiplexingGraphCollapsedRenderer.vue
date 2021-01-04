<template>
    <b-container id="multiplexingToplevelContainer" fluid style="width: 100%;">
        <b-row align-v="center" style="text-align: center;">
            <b-col cols="12">
                <h4>{{(connection !== undefined) ? connection.parent.filename + " : " + connection.getLongName() : ""}}</h4>
            </b-col>
        </b-row>
        <b-row v-if="showstreamdetail" style="width: 100%;" align-v="center">
            <b-col cols="1">
                Selected stream's details
            </b-col>
            <b-col cols="11">
                <div><span :style="streamDetail.style">&nbsp;</span> Stream <span class="font-weight-bold">{{ streamDetail.stream_id }}</span> : Requested at {{ streamDetail.data.requestTime.toFixed(2) }}ms. Transmitted from {{ streamDetail.data.startTime.toFixed(2) }}ms to {{streamDetail.data.endTime.toFixed(2)}}ms ({{ (streamDetail.data.endTime.toFixed(2) - streamDetail.data.startTime.toFixed(2)).toFixed(2) }}ms). {{streamDetail.data.totalData}} bytes spread over {{streamDetail.data.frameCount}} frames (including retransmits). </div>
            </b-col>
        </b-row>
        <b-row v-if="showwaterfall" style="height: 165px; width: 100%;" align-v="center">
            <b-col cols="1">
                Waterfall
            </b-col>
            <b-col cols="11">
                <div style="width: 100%; height: 165px; overflow-y: auto;"> <!-- wrapper to prevent issues with width calculations due to the potential vertical scrollbar -->
                    <div :id="id_waterfall" >
                    </div>
                </div>
            </b-col>
        </b-row>
        <b-row style="height: 5px;">
        </b-row>
        <b-row style="height: 70px;  width: 100%; border: 1px solid red; display: none;" align-v="center">
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
        <b-row style="height: 110px; width: 100%;" align-v="center">
            <b-col cols="1">
                Multiplexed data flow
            </b-col>
            <b-col cols="11">
                <div :id="id_data" style="width: 100%;">
                </div>
            </b-col>
        </b-row>
        <b-row v-if="showbyteranges" style="height: 520px; width: 100%; margin-bottom: 10px;" align-v="center">
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
    import * as qlog from '@/data/QlogSchema';

    import MultiplexingGraphConfig from "./data/MultiplexingGraphConfig";
    import MultiplexingGraphD3SimulationRenderer from "./renderer/MultiplexingGraphD3SimulationRenderer";
    import MultiplexingGraphD3CollapsedRenderer from "./renderer/MultiplexingGraphD3CollapsedRenderer";
    import MultiplexingGraphD3WaterfallRenderer from "./renderer/MultiplexingGraphD3WaterfallRenderer";
    import ColorHelper from '../shared/helpers/ColorHelper';

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

        protected streamDetail:any = null;

        protected skipRender:boolean = false;

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

        protected get showstreamdetail() {
            return this.streamDetail !== null;
        }

        public created() {

            // TODO: hook up the .onStreamClicked on the CollapsedRenderer as well
            // didn't do that at first because the needed information wasn't readily available there yet, only in the waterfall
            this.waterfallRenderer = new MultiplexingGraphD3WaterfallRenderer( this.id_waterfall, (streamDetails:any) => { this.onStreamClicked(streamDetails); } );
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

        protected onStreamClicked(streamDetails:any) {
            // this updates one part of the viz, but would also trigger an update to the rest
            // this messes with our ByteRangesRenderer, since that's not stateful from VUE perspective yet
            // so, as a dirty hack, skip the next render here... also works for now 
            this.skipRender = true;
            this.streamDetail = streamDetails;

            this.streamDetail.style = { display: "inline-block", paddingRight: "10px", width: "50px", height: "100%", backgroundColor : ColorHelper.StreamIDToColor( "" + this.streamDetail.stream_id, "HTTP3" )[0] };
        }

        protected updateRenderers() {

            if ( this.skipRender ) {
                this.skipRender = false;

                return;
            }

            // we need all three renderers to have the exact same width
            // originally, we just had them lookup their container's clientWidth in the renderers themselves
            // however, when adding a vertical scrollbar to the waterfall, this started to break in weird ways
            // so now, we calculate the appropriate width from the page's width here and set hem manually, so in the renderers, container.clientWidth is always correct
            // There is 15px padding on each side for each column, plus for the top level container, so 90px in total
            // up-front col is 1/12th of the width. Then we want 99% (not to cause a horizontal scrollbar as well) of the remaining 11/12th = 0.9075
            const fixedWidth = Math.ceil(((document.getElementById("multiplexingToplevelContainer")!.clientWidth - 90) * 0.9075)) + "px";
            document.getElementById( "" + this.id_waterfall )!.style.width  = fixedWidth;
            document.getElementById( "" + this.id_data )!.style.width       = fixedWidth;
            document.getElementById( "" + this.id_byterange )!.style.width  = fixedWidth;

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
                        // needed to hook up click handlers
                        // FIXME: this is quite dirty... should probably be done with a general config object
                        this.dataRenderer.waterfallRenderer = this.waterfallRenderer;
                    }
                    else {
                        this.dataRenderer.waterfallRenderer = undefined;
                    }
                    // this.fifoRenderer.render( this.connection );
                    this.dataRenderer.render( this.connection );
                }
            }, 100 );
        }
    }

</script>
