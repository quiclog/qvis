<template>
    <div style="background-color: red; color: white; padding: 0px 10px;" >

        <p>Select one or more traces via the dropdown(s) below to visualize them in the sequence diagram</p>

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

    @Component({
        components: {},
    })
    export default class CongestionGraphConfigurator extends Vue {
        @Prop()
        protected config!: CongestionGraphConfig;

        protected store:ConnectionStore = getModule(ConnectionStore, this.$store);

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

        public togglePerspective(){
            alert("Toggling perspective");
            this.config.connection = ( this.store.groups[1].getConnections()[0] );
        }
    }

</script>