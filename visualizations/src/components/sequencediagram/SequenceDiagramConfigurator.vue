<template>
    <div style="background-color: #cce5ff; padding: 0px 10px;" >
        <!--<div>{{(config ? config.manualRTT + " - " + config.scale : "UNKNOWN" )}}</div>-->
        <!--<b-button @click="adjustConfigTest()">Adjust config</b-button> -->

        <p style="margin-top: 10px;">Select one or more traces via the dropdown(s) below to visualize them in the sequence diagram</p>
        <b-container fluid>
            <b-row>
                <ConnectionConfigurator v-for="(connection, index) of this.config.connections" :allGroups="store.groups" :connection="connection" :key="index" :canBeRemoved="index != 0" :onConnectionSelected="onConnectionSelected.bind(this, index)" :onRemoved="onConnectionRemoved.bind(this,index)" />
            </b-row>
        </b-container>
    <!--
        <div v-for="(group, index) of store.groups" :key="index">
            {{group.description}}
            <div v-for="(connection,index) of group.GetConnections()" :key="index">
                - <b-button @click="addConnection(connection)">Add Connection</b-button>
            </div>
        </div>
    -->

        <b-button @click="addConnection()">Add trace</b-button><!-- &#43; PLUS + -->
    </div>
</template>

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue, Prop } from "vue-property-decorator";
    import SequenceDiagramConfig from "./data/SequenceDiagramConfig";
    import ConnectionConfigurator from "@/components/shared/ConnectionConfigurator.vue";

    import ConnectionStore from "@/store/ConnectionStore";
    import ConnectionGroup from "@/data/ConnectionGroup";
    import Connection from "@/data/Connection";

    @Component({
        components: {
            ConnectionConfigurator,
        },
    })
    export default class SequenceDiagramConfigurator extends Vue {
        @Prop()
        protected config!: SequenceDiagramConfig;

        protected store:ConnectionStore = getModule(ConnectionStore, this.$store);


        public adjustConfigTest(group:ConnectionGroup){
            this.config.manualRTT = Math.round(Math.random() * 100);

            this.config.scale = Math.random();
        }

        public onConnectionSelected(connectionIndex:number, connection:Connection){
            console.log("Configurator:onConnectionSelected : ", this.config, connectionIndex, connection);

            // Vue reactivity cannot detect direct index-based changes to an array, i.e.,
            // this.config.connections[connectionIndex] = connection;
            // will not work. We need to use Vue.set (or .slice) to gain reactivity
            Vue.set(this.config.connections, connectionIndex, connection);

            // TODO: auto-select other connections when this one is set
            // ex. we select vantagepoint.CLIENT as the first connection,
            // then we want to set vantagepoint.NETWORK and vantagepoint.SERVER as the next two, if they exist
            // this of course also implies adding new connections to this.config.connections

            // if we selected a group with just 1, we probably want to auto-generate its counterpart, so de-select any others we might have had before
            if ( connectionIndex === 0 && connection.parent.getConnections().length === 1 ){
                const connections = connection.parent.getConnections();
                this.config.connections = connections.slice();
            }

            // just select all other connections after this one from the same parent if there are more than 1 in a group
            else if ( connectionIndex === 0 && connection.parent.getConnections().length > 1 ){
                const connections = connection.parent.getConnections();
                const connectionIndexInParent = connections.indexOf(connection);
                let rendererIndex = 1;
                for ( let i = connectionIndexInParent + 1; i < connections.length; ++i ){
                    // Vue.set works like .push when the index isn't yet in the array
                    Vue.set( this.config.connections, rendererIndex, connections[i] );
                    ++rendererIndex;
                }

                this.config.connections.splice(rendererIndex); // remove everything starting at this index
            }
        }

        public created(){
            // TODO: remove, only for debugging
            if ( this.config.connections.length === 0 ){
                this.addConnection();
            }
        }

        public addConnection(){
            console.log("addConnection: adding new connection configurator");
            this.config.connections.push( this.store.groups[0].getConnections()[0] );
        }

        protected onConnectionRemoved(connectionIndex:number){
            this.config.connections.splice(connectionIndex, 1);
        }
    }

</script>
