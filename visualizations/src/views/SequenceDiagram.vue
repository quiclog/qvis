<template>
    <div>
        <SequenceDiagramContainer />
    </div>
</template> 

<script lang="ts">
    import { Component, Vue } from "vue-property-decorator";
    import SequenceDiagramContainer from "@/components/sequencediagram/SequenceDiagramContainer.vue";

    @Component({
        components: {
            SequenceDiagramContainer,
        },
    })
    export default class SequenceDiagram extends Vue {} 
</script>
