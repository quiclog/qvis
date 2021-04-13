<template>
    <div style="background-color: #d4edda; padding: 0px 10px;" >

        <b-container fluid>
            <b-row align-h="center">
                <p  style="margin-top: 10px;">Select a trace via the dropdown(s) below to visualize it in the congestion graph</p>
            </b-row>
            <b-row align-h="center">
                <ConnectionConfigurator v-if="config.connection !== undefined" :allGroups="store.groups" :connection="config.connection" :canBeRemoved="false" :onConnectionSelected="onConnectionSelected" />
            </b-row>
            <b-row align-h="center">
                <b-button @click="resetZoom()">Reset zoom</b-button>
                <b-button @click="useBrushX()" v-b-tooltip.hover title="Click this button, then drag and drop a horizontal time range to zoom in on.">Zoom timerange</b-button>
                <b-button @click="useBrush2d()" v-b-tooltip.hover title="Click this button, then drag and drop a rectangular area to zoom in on.">Zoom area</b-button>
                <b-button @click="useRuler()" v-b-tooltip.hover title="Click this button or press R, then drag and drop a line to see the time and byte ranges it spans">Ruler (press R)</b-button>
                <b-button @click="toggleCongestionGraph()">Toggle congestion info</b-button>
                <b-button @click="toggleRTTZoom()">Toggle RTT zooming</b-button>
                <!--<b-button @click="togglePerspective()" v-if="isClientSideTrace"  v-b-tooltip.hover title="You have selected a trace from a client-side perspective, while this tool works best for server-side. Press this button to simulate a server-side view (by swapping packet_sent and packet_received)" variant="danger">Toggle perspective</b-button>-->
            </b-row>

            <b-alert v-if="this.store.outstandingRequestCount === 0 && this.store.groups.length === 0" show variant="danger">Please load a trace file to visualize it</b-alert>
            <b-alert v-else-if="this.store.groups.length === 0" show variant="warning">Loading files...</b-alert>

        </b-container>

    </div>
</template>

<style scoped>
    .row {
        padding-bottom: 10px;
    }

    .btn {
        margin: 0px 5px;
    }
</style>

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue, Prop } from "vue-property-decorator";
    import CongestionGraphConfig from "./data/CongestionGraphConfig";
    import * as qlog from '@/data/QlogSchema';

    import ConnectionConfigurator from "@/components/shared/ConnectionConfigurator.vue";
    import ConnectionStore from "@/store/ConnectionStore";
    import ConnectionGroup from "@/data/ConnectionGroup";
    import Connection from "@/data/Connection";

    @Component({
        components: {
            ConnectionConfigurator,
        },
    })
    export default class CongestionGraphConfigurator extends Vue {
        @Prop()
        public config!: CongestionGraphConfig;

        public store:ConnectionStore = getModule(ConnectionStore, this.$store);

        public onConnectionSelected(connection:Connection) {
            console.log("CongestionGraphConfigurator:onConnectionSelected : ", this.config, connection);

            this.config.connection = connection;
        }

        public resetZoom(){
            // TODO hook up properly
            this.config.renderer.resetZoom();
        }

        public useBrushX(){
            // TODO hook up properly
            this.config.renderer.useBrushX();
        }

        public useBrush2d(){
            // TODO hook up properly
            this.config.renderer.useBrush2d();
        }

        public useRuler(evt:any = undefined) {
            if ( evt ){
                // console.error( " KEYUP ", evt );
                if ( evt.code !== "KeyR" ){
                    return;
                }
            }

            console.log("CongestionGraphConfigurator: Using ruler");

            this.config.renderer.useRuler();
        }

        public toggleCongestionGraph(){
            // TODO hook up properly
            this.config.renderer.toggleCongestionGraph();
        }

        public toggleRTTZoom() {
            this.config.renderer.toggleZoomingRTTGraph();
        }

        public togglePerspective(){
            // TODO hook up properly
            this.config.renderer.togglePerspective();
        }

        protected get isClientSideTrace(){
            return  this.config && 
                    this.config.connection && 
                    this.config.connection.vantagePoint && 
                    (this.config.connection.vantagePoint.type === qlog.VantagePointType.client || this.config.connection.vantagePoint.flow === qlog.VantagePointType.client);
        }

        public mounted(){
            if ( this.config.connection === undefined && this.store.groups.length > 0 ){
                this.selectDefault();
            }

            document.addEventListener('keyup', this.useRuler);
        }

        public beforeDestroy() {
            document.removeEventListener("keyup", this.useRuler);
        }

        public updated(){
            if ( this.config.connection === undefined && this.store.groups.length > 0 ){
                this.selectDefault();
            }
        }

        protected selectDefault(){
            console.log("selectDefault: adding new default connection configurator", this.store.groups);
            this.config.connection = ( this.store.groups[0].getConnections()[0] );
        }
    }

</script>
