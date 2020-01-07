<template>
    <div>
        <MultiplexingGraphContainer />
    </div>
</template>

<script lang="ts">
    import { Component, Vue } from "vue-property-decorator";
    import MultiplexingGraphContainer from "@/components/multiplexinggraph/MultiplexingGraphContainer.vue";

    @Component({
        components: {
            MultiplexingGraphContainer,
        },
    })
    export default class MultiplexingGraph extends Vue {}
</script>
