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
		<p class="byline">
			by <a href="https://allanlasser.com">Allan Lasser</a>
		</p>
    {#if data?.admin}
      <div class="admin-links">
        <a href="/admin">Admin</a>
        <SignOut />
      </div>
    {:else}
      <div class="subscribe-links">
        <a href="https://buttondown.com/compostmodernism">Email</a>
        <a href="/feeds/posts.xml">RSS</a>
      </div>
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
		grid-template-areas:
			'title .'
			'byline links';
		align-items: baseline;
		gap: 0 var(--space-gap);
		width: 100%;
		max-width: var(--content-max);
		padding: var(--space-header) var(--space-gap) 0;
	}

  .site-header a:hover {
    text-decoration: underline;
  }

  a.site-title:hover {
    text-decoration-color: var(--color-ink-soft);
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }

	.site-title {
		grid-area: title;
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-title);
		line-height: normal;
		text-decoration: none;
		white-space: nowrap;
	}

  .admin-links,
  .subscribe-links {
    grid-area: links;
    display: flex;
    flex-wrap: wrap;
    align-self: baseline;
    gap: 1em;
    font-style: italic;
    font-size: var(--size-meta);
    color: var(--color-ink-soft);
  }

	.byline {
		grid-area: byline;
		font-style: italic;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

  .subscribe-links a,
  .admin-links a,
	.byline a {
		text-decoration: none;
    &:hover {
      color: var(--color-ink);
    }
	}

	.site-main {
		width: 100%;
		max-width: var(--content-max);
		padding: var(--space-section) var(--space-gap);
    margin-bottom: calc(3*var(--space-section));
	}

  @media (max-width: 760px) {
    .site-header {
			padding: 2em 1em 0;
		}
		.site-main {
			padding: var(--space-section) 1em;
		}
  }

	@media (max-width: 640px) {
		.site-header {
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'title title'
				'byline links';
			column-gap: var(--space-stack);
		}
	}

	@media (max-width: 240px) {
		.site-header {
			grid-template-columns: 1fr;
			grid-template-areas:
				'title'
				'byline'
				'links';
		}
	}
</style>
