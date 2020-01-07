<template>
    <div style="background-color: #d1ecf1; padding: 0px 10px;" >

        <b-container fluid>
            <b-row align-h="center">
                <p  style="margin-top: 10px;">Select a trace via the dropdown(s) below to visualize it in the stream graph</p>
            </b-row>
            <b-row align-h="center">
                <ConnectionConfigurator v-if="config.connections.length > 0" :allGroups="store.groups" :connection="config.connections[0]" :canBeRemoved="false" :onConnectionSelected="onConnectionSelected" />
            </b-row>

            <!-- <b-row align-h="center">
                <b-form-checkbox
                    id="collapsed-checkbox"
                    v-model="config.collapsed"
                    name="collapsed-checkbox"
                >
                    Collapse timeline
                </b-form-checkbox>
            </b-row> -->

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
    export default class MultiplexingGraphConfigurator extends Vue {
        @Prop()
        public config!: MultiplexingGraphConfig;

        public store:ConnectionStore = getModule(ConnectionStore, this.$store);

        public onConnectionSelected(connection:Connection) {
            console.log("MultiplexingGraphConfigurator:onConnectionSelected : ", this.config, connection);

            this.config.connections = [ connection ];
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
