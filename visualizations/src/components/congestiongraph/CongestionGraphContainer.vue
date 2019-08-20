<template>
    <div class="home">
        <CongestionGraphConfigurator :config="config"/>
        <div id="packetInfo" style="position: absolute; display: none; z-index: 100; padding: 5px; border: 1px solid black; background-color: white;">
            <p id="timestamp"></p>
            <p id="packetNr"></p>
            <p id="packetSize"></p>
            <p id="ackedFrom"></p>
            <p id="ackedTo"></p>
        </div>
        <CongestionGraphRenderer :config="config"/>
    </div>
</template>

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";

    import CongestionGraphConfig from "./data/CongestionGraphConfig";
    import CongestionGraphConfigurator from "./CongestionGraphConfigurator.vue";
    import CongestionGraphRenderer from "./CongestionGraphRenderer.vue";

    import ConfigurationStore from "@/store/ConfigurationStore";
    import ConnectionGroup from "@/data/ConnectionGroup";


    @Component({
        components: {
            CongestionGraphConfigurator,
            CongestionGraphRenderer,
        },
    })

    export default class CongestionGraphContainer extends Vue {

        protected store:ConfigurationStore = getModule(ConfigurationStore, this.$store);
        // tslint:disable-next-line:member-ordering
        public config:CongestionGraphConfig = this.store.congestionGraphConfig;

        public created(){
            console.log("container created", this.config);
        }

    }
</script>
