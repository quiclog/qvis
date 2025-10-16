import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	// otherwise we get 1000+ warns for bootstrap
	// https://stackoverflow.com/questions/60677782/how-to-disable-svelte-warning-unused-css-selector
	onwarn: (warning, handler) => {
        if (warning.code === 'css-unused-selector') {
            return;
        }
        handler(warning);
    },

	kit: {
		// using static adapter for SPA functionality for now
		adapter: adapter({
			fallback: 'index.html' // may differ from host to host
		}),
		alias: {
			'@src': 'src/*',
			'@lib': 'src/lib/*'
		}
	}
};

export default config;
