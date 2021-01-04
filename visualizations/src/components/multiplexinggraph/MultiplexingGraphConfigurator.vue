<template>
    <div style="background-color: #d1ecf1; padding: 0px 10px;" >

        <b-container fluid>
            <b-row align-h="center">
                <p  style="margin-top: 10px;">Select a trace via the dropdown(s) below to visualize it in the stream graph</p>
            </b-row>
            <b-row align-h="center">
                <ConnectionConfigurator v-if="config.connections.length > 0" :allGroups="store.groups" :connection="config.connections[0]" :canBeRemoved="false" :onConnectionSelected="onConnectionSelected" />
            </b-row>

            <b-row align-h="center">
                <b-form-checkbox
                    id="waterfall-checkbox"
                    v-model="config.showwaterfall"
                    name="waterfall-checkbox"
                    class="mr-3"
                >
                    Show waterfall
                </b-form-checkbox>

                <b-form-checkbox
                    id="byteranges-checkbox"
                    v-model="config.showbyteranges"
                    name="byteranges-checkbox"
                >
                    Show byte ranges
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
    import MultiplexingGraphConfig from "./data/MultiplexingGraphConfig";
    import * as qlog from '@/data/QlogSchema';

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
    export default class MultiplexingGraphConfigurator extends Vue {
        @Prop()
        public config!: MultiplexingGraphConfig;

        public store:ConnectionStore = getModule(ConnectionStore, this.$store);

        public onConnectionSelected(connection:Connection) {
            console.log("MultiplexingGraphConfigurator:onConnectionSelected : ", this.config, connection);

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

            this.config.showwaterfall = false;
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
            console.log("MultiplexingGraphConfigurator:selectDefault: adding new default connection configurator", this.store.groups);
            this.config.connections = [ this.store.groups[0].getConnections()[0] ];
        }
    }

</script>
