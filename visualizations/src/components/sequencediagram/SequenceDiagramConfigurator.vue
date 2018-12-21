<template>
    <div>
        <div>{{(config ? config.name + " - " + config.description : "UNKNOWN" )}}</div>
        <b-button @click="adjustConfigTest()">Adjust name</b-button> 

        <div v-for="(group, index) of store.groups" :key="index">
            {{group.description}}
            <b-button @click="adjustConfigTest(group)">Choose Group</b-button> 
        </div>
    </div>
</template> 

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue, Prop } from "vue-property-decorator";
    import SequenceDiagramConfig from "./data/SequenceDiagramConfig";

    import ConnectionStore from "@/store/ConnectionStore";
    import ConnectionGroup from "@/data/ConnectionGroup";

    @Component
    export default class SequenceDiagramConfigurator extends Vue {
        @Prop()
        public config!: SequenceDiagramConfig;

        protected store:ConnectionStore = getModule(ConnectionStore, this.$store);

        public adjustConfigTest(group:ConnectionGroup){
            this.config.name = "Robin " + Math.round(Math.random() * 100);

            if( group ){
                this.config.setDescription( group.description );
            }
            else {
                this.config.setDescription("Marx " + Math.round(Math.random() * 100) );
            }
        }
    } 

</script>