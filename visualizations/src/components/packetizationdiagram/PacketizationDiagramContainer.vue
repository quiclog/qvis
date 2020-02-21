<template>
    <div class="home">
        <PacketizationDiagramConfigurator :config="config"/>
        <PacketizationDiagramRenderer :config="config"/>
    </div>
</template> 

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";

    import PacketizationDiagramConfig from "./data/PacketizationDiagramConfig"; 
    import PacketizationDiagramConfigurator from "./PacketizationDiagramConfigurator.vue";
    import PacketizationDiagramRenderer from "./PacketizationDiagramRenderer.vue"; 

    import ConfigurationStore from "@/store/ConfigurationStore";
    import ConnectionGroup from "@/data/ConnectionGroup";


    @Component({
        components: {
            PacketizationDiagramConfigurator,
            PacketizationDiagramRenderer,
        },
    })

    export default class PacketizationDiagramContainer extends Vue {

        protected store:ConfigurationStore = getModule(ConfigurationStore, this.$store);
        protected config:PacketizationDiagramConfig = this.store.packetizationDiagramConfig;
    } 
</script>
