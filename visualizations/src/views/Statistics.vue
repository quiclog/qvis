<template>
    <div>
        <StatisticsContainer />
    </div>
</template> 

<script lang="ts">
    import { Component, Vue } from "vue-property-decorator";
    import StatisticsContainer from "@/components/stats/StatisticsContainer.vue";

    @Component({
        components: {
            StatisticsContainer,
        },
    })
    export default class Statistics extends Vue {} 
</script>
