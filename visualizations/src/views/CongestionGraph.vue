<template>
    <div>
        <CongestionGraphContainer />
    </div>
</template>

<script lang="ts">
    import { Component, Vue } from "vue-property-decorator";
    import CongestionGraphContainer from "@/components/congestiongraph/CongestionGraphContainer.vue";

    @Component({
        components: {
            CongestionGraphContainer,
        },
    })
    export default class CongestionGraph extends Vue {}
</script>
