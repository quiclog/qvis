<template>
    <div class="home">
        <MultiplexingGraphConfigurator :config="config"/>
        <MultiplexingGraphRenderer :config="config"/>
    </div>
</template> 

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";

    import MultiplexingGraphConfig from "./data/MultiplexingGraphConfig"; 
    import MultiplexingGraphConfigurator from "./MultiplexingGraphConfigurator.vue";
    import MultiplexingGraphRenderer from "./MultiplexingGraphRenderer.vue";

    import ConfigurationStore from "@/store/ConfigurationStore";
    import ConnectionGroup from "@/data/ConnectionGroup";


    @Component({
        components: {
            MultiplexingGraphConfigurator,
            MultiplexingGraphRenderer,
        },
    })

    export default class MultiplexingGraphContainer extends Vue {

        protected store:ConfigurationStore = getModule(ConfigurationStore, this.$store);
        protected config:MultiplexingGraphConfig = this.store.multiplexingGraphConfig;
    } 
</script>
