<script lang="ts">
  import SignOut from '$lib/components/admin/SignOut.svelte';
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
    {#if data?.admin}
      <div class="admin-links">
        <a href="/admin">Admin</a>
        <SignOut />
      </div>
    {:else}
		  <p class="byline">
        by <a href="https://allanlasser.com">Allan Lasser</a>
      </p>
    {/if}
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
    align-items: baseline;
		gap: var(--space-gap);
		width: 100%;
		max-width: var(--content-max);
		padding: var(--space-header) var(--space-gap) 0;
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

  .admin-links {
    display: flex;
    flex-wrap: wrap;
    align-self: baseline;
    justify-content: flex-end;
    gap: 1em;
    font-style: italic;
    font-size: var(--size-meta);
    color: var(--color-ink-soft);
  }

	.byline {
		align-self: baseline;
		font-style: italic;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

  .admin-links a,
	.byline a {
		text-decoration: none;
	}

	.site-main {
		width: 100%;
		max-width: var(--content-max);
		padding: var(--space-section) var(--space-gap);
    margin-bottom: calc(3*var(--space-section));
	}

	@media (max-width: 640px) {
		.site-header {
      align-items: baseline;
			gap: var(--space-stack);
			padding: 2em 1em 0;
		}
		.site-main {
			padding: 0 1em;
		}
	}
</style>
