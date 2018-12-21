<template>
    <div>
        <div>{{config.name}}</div>
        <div>{{desc}}</div>
    </div>
</template> 

<script lang="ts">
    import { Component, Vue, Prop } from "vue-property-decorator";
    import SequenceDiagramConfig from "./data/SequenceDiagramConfig";

    @Component
    export default class SequenceDiagramRenderer extends Vue {
        @Prop()
        public config!: SequenceDiagramConfig;


        protected get desc(){
            return this.config.description + " is the description";
        }
    } 

</script>