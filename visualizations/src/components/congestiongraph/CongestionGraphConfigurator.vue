<template>
    <div style="background-color: #d4edda; padding: 0px 10px;" >

        <p>Select a trace via the dropdown(s) below to visualize it in the congestion graph</p>

        <b-button @click="loadTrace()">Load trace</b-button>
        <b-button @click="resetZoom()">Reset zoom</b-button>
        <b-button @click="useBrushX()">Zoom timerange</b-button>
        <b-button @click="useBrush2d()">Zoom area</b-button>
        <b-button @click="toggleCongestionGraph()">Toggle congestion info</b-button>
        <b-button @click="togglePerspective()">Toggle perspective</b-button>
    </div>
</template>

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue, Prop } from "vue-property-decorator";
    import CongestionGraphConfig from "./data/CongestionGraphConfig";

    import ConnectionStore from "@/store/ConnectionStore";
    import ConnectionGroup from "@/data/ConnectionGroup";
    import Connection from "@/data/Connection";

    @Component({})

    export default class CongestionGraphConfigurator extends Vue {
        @Prop()
        public config!: CongestionGraphConfig;

        public store:ConnectionStore = getModule(ConnectionStore, this.$store);

        public created(){
            // TODO: remove, only for debugging
            if ( this.config.connection === undefined ){
                this.setConnection();
            }
        }

        public setConnection(){
            console.log("addConnection: adding new connection configurator");
            this.config.connection = ( this.store.groups[0].getConnections()[0] );
        }

        public loadTrace(){
            console.log("Loading trace...", this.config);
            this.config.connection = ( this.store.groups[4].getConnections()[0] );
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

        public toggleCongestionGraph(){
            // TODO hook up properly
            this.config.renderer.toggleCongestionGraph();
        }

        public togglePerspective(){
            // TODO hook up properly
            this.config.renderer.togglePerspective();
        }
    }

</script>
