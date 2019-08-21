<template>
    <div class="home">
        <StatisticsConfigurator :config="config"/>
        <StatisticsRenderer :config="config"/>
    </div>
</template>

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";

    import StatisticsConfig from "./data/StatisticsConfig";
    import StatisticsConfigurator from "./StatisticsConfigurator.vue";
    import StatisticsRenderer from "./StatisticsRenderer.vue";

    import ConfigurationStore from "@/store/ConfigurationStore";
    import ConnectionGroup from "@/data/ConnectionGroup";


    @Component({
        components: {
            StatisticsConfigurator,
            StatisticsRenderer,
        },
    })

    export default class StatisticsContainer extends Vue {

        protected store:ConfigurationStore = getModule(ConfigurationStore, this.$store);
        // tslint:disable-next-line:member-ordering
        public config:StatisticsConfig = this.store.statisticsConfig;

        public created(){
            console.log("statistics container created", this.config);
        }

    }
</script>
