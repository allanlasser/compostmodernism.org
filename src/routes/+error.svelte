<script lang="ts">
	import { page } from '$app/state';
	import { SITE_NAME } from '$lib/social';

	const heading = $derived(page.status === 404 ? 'Not found' : 'Something went wrong');
</script>

<svelte:head>
	<title>{heading} · {SITE_NAME}</title>
</svelte:head>

<div class="error">
	<h1>{page.error?.message ?? heading}</h1>
	<p><a href="/">Back to the homepage</a></p>
</div>

<style>
	.error {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
		padding-top: var(--space-header);
	}

	h1 {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-title);
		color: var(--color-ink-soft);
	}

	a {
		color: var(--color-ink-soft);
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
		&:hover {
			color: var(--color-ink);
		}
	}
</style>
