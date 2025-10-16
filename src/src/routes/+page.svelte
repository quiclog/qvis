
<script lang="ts">
    import FileManagerContainer from "@src/lib/components/filemanager/FileManagerContainer.svelte";
    import TestForm from "@src/lib/components/test/TestForm.svelte";
    import TestReflector from "@src/lib/components/test/TestReflector.svelte";
</script>

<h1>Welcome to qvis v2.0</h1>

<button type="button" class="btn btn-primary">Base class to test bootstrap</button>

<FileManagerContainer />

form: 
<TestForm />

reflector:
<TestReflector />