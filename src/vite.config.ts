import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	css: {
		preprocessorOptions: {
			scss: {
				// to remove some warnings for bootstrap integration
				silenceDeprecations: [
					'import',
					'mixed-decls',
					'color-functions',
					'global-builtin'
				],
			},
		},
	},
	plugins: [sveltekit()]
});
