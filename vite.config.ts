/// <reference types="vitest" />
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	test: {
		environment: 'node',
		environmentMatchGlobs: [['src/**/*.svelte.test.ts', 'happy-dom']],
		setupFiles: ['./vitest.setup.ts']
	}
});
