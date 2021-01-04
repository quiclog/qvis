<template>
    <div style="background-color: #fff3cd; padding: 0px 10px;" >

        <b-container fluid>
            <b-row align-h="center">
                <p style="margin-top: 10px;">Select a file via the dropdown(s) below to view its statistics</p>
            </b-row>
            <b-row align-h="center">
                <ConnectionConfigurator v-if="config.group !== undefined" :allGroups="store.groups" :group="config.group" :canBeRemoved="false" :allowGroupSelection="true" :allowConnectionSelection="false" :onGroupSelected="onGroupSelected" />
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
    import StatisticsConfig from "./data/StatisticsConfig";
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
    export default class StatisticsConfigurator extends Vue {
        @Prop()
        public config!: StatisticsConfig;

        public store:ConnectionStore = getModule(ConnectionStore, this.$store);

        public onGroupSelected(group:ConnectionGroup) {
            console.log("StatisticsConfigurator:onGroupSelected : ", this.config, group);

            this.config.group = group;
        }

        public mounted(){
            if ( this.config.group === undefined && this.store.groups.length > 0 ){
                this.selectDefault();
            }
        }

        public updated(){
            if ( this.config.group === undefined && this.store.groups.length > 0 ){
                this.selectDefault();
            }
        }

        protected selectDefault(){
            console.log("selectDefault: adding new default connection configurator", this.store.groups);
            this.config.group = ( this.store.groups[0] );
        }

    }

</script>
