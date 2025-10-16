<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	// this imports bootstrap, 
	// but somehow imports the WHOLE file as an inlined JS string instead of normal transpiled CSS. 
	// Don't really know why
	// trying to get only the used classes by using <style lang=scss> had the problem of not automatically making the styles available to other files (only things in +layout.svelte worked)
	// I was unable to find a workaround for this (adding "global" to the style tag didn't have any impact AFAICT)
	// TODO: investigate this further down the line (maybe)
	import "@src/app.scss";
	import "@src/global.css";

	let { children } = $props(); 
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
