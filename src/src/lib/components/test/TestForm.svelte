
<script lang="ts">

    import { store } from "@lib/components/test/TestStore.svelte";
    
    function updateStore() {
        console.log("Updating store - loading random file");
        store.DEBUG_LoadRandomFile("RobinAddsStuff " + Math.random());
    }

</script>

<h1>Simple form to try out global store</h1>

<button on:click={updateStore}>Update store (load random file)</button>

