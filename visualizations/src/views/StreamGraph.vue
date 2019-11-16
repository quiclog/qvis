<template>
    <div>
        <StreamGraphContainer />
    </div>
</template>

<script lang="ts">
    import { Component, Vue } from "vue-property-decorator";
    import StreamGraphContainer from "@/components/streamgraph/StreamGraphContainer.vue";

    @Component({
        components: {
            StreamGraphContainer,
        },
    })
    export default class StreamGraph extends Vue {}
</script>
