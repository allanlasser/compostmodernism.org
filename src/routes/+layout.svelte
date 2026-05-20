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
		<span>
      <a class="site-title" href="/">compostmodernism</a>
      <p class="byline">
        by <a href="https://allanlasser.com">Allan Lasser</a>
      </p>
    </span>
    {#if data?.admin}
      <div class="admin">
        <p>Hi, Allan!</p>
        <div class="admin-links">
          <a href="/admin">Admin</a>
          <SignOut />
        </div>
      </div>
    {:else}
		  <div class="subscribe">
        <p>Subscribe</p>
        <div class="subscribe-links">
          <a href="https://buttondown.com/compostmodernism">Email</a>
          <a href="/feeds/posts.xml">RSS</a>
        </div>
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

  .admin-links,
  .subscribe-links {
    display: flex;
    flex-wrap: wrap;
    align-self: baseline;
    gap: 1em;
    font-style: italic;
    font-size: var(--size-meta);
    color: var(--color-ink-soft);
  }

  .subscribe p {
    font-size: var(--size-meta);
  }

	.byline {
		align-self: baseline;
		font-style: italic;
    justify-content: flex-end;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

  .subscribe-links a,
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
      grid-template-columns: 1fr;
      align-items: baseline;
			gap: 0.5em var(--space-stack);
		}
    .admin-links {
      justify-content: flex-start;
    }
    .subscribe {
      display: flex;
      align-items: baseline;
      gap: 1em;
    }
	}
</style>
