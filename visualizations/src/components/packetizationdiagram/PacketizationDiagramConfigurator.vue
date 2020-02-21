<template>
    <div style="background-color: #f8d7da; padding: 0px 10px;" >

        <b-container fluid>
            <b-row align-h="center">
                <h1>NOTE: this currently only works for TCP + TLS + HTTP/2 traces, not QUIC + HTTP/3!</h1>
            </b-row>
            <b-row align-h="center">
                <p  style="margin-top: 10px;">Select a trace via the dropdown(s) below to visualize it in the packetization diagram</p>
            </b-row>
            <b-row align-h="center">
                <ConnectionConfigurator v-if="config.connections.length > 0" :allGroups="store.groups" :connection="config.connections[0]" :canBeRemoved="false" :onConnectionSelected="onConnectionSelected" />
            </b-row>

            <b-row align-h="center">
                <b-form-checkbox
                    id="collapsed-checkbox"
                    v-model="config.collapsed"
                    name="collapsed-checkbox"
                    class="mr-3"
                >
                    Show collapsed
                </b-form-checkbox>

                <b-button class="ml-3" v-if="allowSelectAll" @click="selectAllConnections()" :disabled="config.connections.length === 0" variant="primary">Load all connections at once</b-button>
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
    import PacketizationDiagramConfig from "./data/PacketizationDiagramConfig";
    import * as qlog from '@quictools/qlog-schema';

    import ConnectionConfigurator from "@/components/shared/ConnectionConfigurator.vue";
    import ConnectionStore from "@/store/ConnectionStore";
    import ConnectionGroup from "@/data/ConnectionGroup";
    import Connection from "@/data/Connection";
    import QlogConnection from '@/data/Connection';

    @Component({
        components: {
            ConnectionConfigurator,
        },
    })
    export default class PacketizationDiagramConfigurator extends Vue {
        @Prop()
        public config!: PacketizationDiagramConfig;

        public store:ConnectionStore = getModule(ConnectionStore, this.$store);

        public onConnectionSelected(connection:Connection) {
            console.log("PacketizationDiagramConfigurator:onConnectionSelected : ", this.config, connection);

            this.config.connections = [ connection ];
        }

        public get allowSelectAll() : boolean {
            return (window.location.toString().indexOf(":8080") >= 0 ); // only for local testing for now! // TODO: CLEAN UP
        }

        public selectAllConnections() {

            // TODO: just for paper results, remove!
            (window as any).holblockinfo = new Array<any>();

            const conns = [];
            for ( const group of this.store.groups ){
                if ( group.filename.indexOf("DEMO") < 0 ){
                    conns.push( ...group.getConnections() );
                }
            }

            this.config.connections = conns;
        }

        public mounted(){
            if ( this.config.connections.length === 0 && this.store.groups.length > 0 ){
                this.selectDefault();
            }
        }

        public updated(){
            if ( this.config.connections.length === 0 && this.store.groups.length > 0 ){
                this.selectDefault();
            }
        }

        protected selectDefault(){
            console.log("PacketizationDiagramConfigurator:selectDefault: adding new default connection configurator", this.store.groups);
            this.config.connections = [ this.store.groups[0].getConnections()[0] ];
        }
    }

</script>
