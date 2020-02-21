<template>
    <div>
        <PacketizationDiagramContainer />
    </div>
</template> 

<script lang="ts">
    import { Component, Vue } from "vue-property-decorator";
    import PacketizationDiagramContainer from "@/components/packetizationdiagram/PacketizationDiagramContainer.vue";

    @Component({
        components: {
            PacketizationDiagramContainer,
        },
    })
    export default class PacketizationDiagram extends Vue {} 
</script>
