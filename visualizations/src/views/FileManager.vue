<template>
    <div>
        <FileManagerContainer />
    </div>
</template> 

<script lang="ts">
    import { Component, Vue } from "vue-property-decorator";
    import FileManagerContainer from "@/components/filemanager/FileManagerContainer.vue";

    @Component({
        components: {
            FileManagerContainer,
        },
    })
    export default class FileManager extends Vue {} 
</script>
