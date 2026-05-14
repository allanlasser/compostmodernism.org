/// <reference types="vitest" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'node',
		environmentMatchGlobs: [['src/**/*.svelte.test.ts', 'happy-dom']],
		setupFiles: ['./vitest.setup.ts']
	}
});
