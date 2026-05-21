import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	ssr: {
		noExternal: ['@lucide/svelte']
	},
	test: {
		setupFiles: ['./vitest.setup.ts'],
		projects: [
			{
				extends: true,
				test: {
					name: 'node',
					environment: 'node',
					include: ['src/**/*.test.ts'],
					exclude: ['src/**/*.svelte.test.ts']
				}
			},
			{
				extends: true,
				test: {
					name: 'dom',
					environment: 'happy-dom',
					include: ['src/**/*.svelte.test.ts']
				}
			}
		]
	}
});
