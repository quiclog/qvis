<template>
    <div class="home">
        <CongestionGraphConfigurator :config="config"/>
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
        protected config:CongestionGraphConfig = this.store.congestionGraphConfig;

    }
</script>
