<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		data?: { admin?: boolean };
	}

	let { children, data }: Props = $props();
</script>

<div class="page">
	<header class="site-header">
		<a class="site-title" href="/">compostmodernism</a>
		<p class="byline">
			{#if data?.admin}
				<a class="admin-link" href="/admin">Admin</a>
      {:else}
        by <a href="https://allanlasser.com">Allan Lasser</a>
			{/if}
		</p>
	</header>

	<main class="site-main">
		{@render children()}
	</main>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 100vh;
	}

	.site-header {
		display: grid;
		grid-template-columns: 1fr var(--space-rail);
		gap: var(--space-gap);
		width: 100%;
		max-width: var(--content-max);
		padding: var(--space-header) var(--space-gap);
	}

  .site-header a:hover {
    text-decoration: underline;
  }

	.site-title {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-title);
		line-height: normal;
		text-decoration: none;
		white-space: nowrap;
	}

	.byline {
		align-self: center;
		font-style: italic;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

	.byline a {
		text-decoration: none;
	}

	.admin-link {
		font-style: normal;
	}

	.site-main {
		width: 100%;
		max-width: var(--content-max);
		padding: var(--space-section) var(--space-gap);
    margin-bottom: calc(3*var(--space-section));
	}

	@media (max-width: 640px) {
		.site-header {
			grid-template-columns: 1fr;
			gap: var(--space-stack);
			padding: var(--space-gap) var(--space-section);
		}
		.site-main {
			padding: var(--space-section);
		}
	}
</style>
