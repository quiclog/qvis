<template>
    <div class="home">
        <StreamGraphConfigurator :config="config"/>
        <StreamGraphRenderer :config="config"/>
    </div>
</template> 

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";

    import StreamGraphConfig from "./data/StreamGraphConfig"; 
    import StreamGraphConfigurator from "./StreamGraphConfigurator.vue";
    import StreamGraphRenderer from "./StreamGraphRenderer.vue";

    import ConfigurationStore from "@/store/ConfigurationStore";
    import ConnectionGroup from "@/data/ConnectionGroup";


    @Component({
        components: {
            StreamGraphConfigurator,
            StreamGraphRenderer
        },
    })

    export default class StreamGraphContainer extends Vue {

        protected store:ConfigurationStore = getModule(ConfigurationStore, this.$store);
        protected config:StreamGraphConfig = this.store.streamGraphConfig;
    } 
</script>
