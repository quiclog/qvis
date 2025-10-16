

<script lang="ts">

    import { store } from "@src/lib/store/ConnectionStore.svelte";

</script>

<h1>Simple reflector to show what happens if store gets updated</h1>


{#each store.groups as group}
    <div>
        <h2>Group {group.description}</h2>
        {#each group.getConnections() as conn}
            <div>
                Connection: {conn.description} - Events: {conn.getEvents().length}
            </div>
        {/each}
    </div>
{/each  }