<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import Dateline from './Dateline.svelte';
	import TagList from './TagList.svelte';
	import { renderMarkdown } from '$lib/markdown';
  import type { Post } from '$lib/types';

	interface Props {
		item: Post;
    rail?: Snippet;
	}

	let { item, rail }: Props = $props();

	let post = $state<Post>(untrack(() => ({ ...item, tags: [...item.tags] })));
	let bodyHtml = $derived(renderMarkdown(post.body));
</script>

<article
	class="post"
	class:post--link={post.url}
	class:post--titled={!post.url && post.title}
	class:post--plain={!post.url && !post.title}
>
	<div class="content">
    {#if post.title}
      <h2>
        {#if post.url}
          <a href={post.url} target="_blank" rel="noopener noreferrer">
            {post.title} <span class="link-marker" aria-hidden="true">➻</span>
          </a>
        {:else}
          {post.title}
        {/if}
      </h2>
    {/if}
    <div class="body">{@html bodyHtml}</div>
	</div>

	<aside class="rail">
    <a class="permalink" href={post.permalink}>
      <Dateline date={post.date} />
    </a>
    <TagList tags={post.tags} />
    {#if rail}{@render rail()}{/if}
	</aside>
</article>

<style>
	.post {
		display: grid;
		grid-template-columns: 1fr var(--space-rail);
		gap: var(--space-gap);
		width: 100%;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
		min-width: 0;
	}

	.body :global(p) {
		font-size: var(--size-body);
		line-height: var(--leading-body);
		margin: 0;
	}

	.body :global(p + p) {
		margin-top: var(--space-stack);
	}

	.body :global(img) {
		display: block;
		max-width: 100%;
		height: auto;
		margin-top: var(--space-stack);
    border-radius: 4px;
	}

	.body :global(a) {
		color: inherit;
	}

	.body :global(strong) {
		font-weight: 600;
	}

	.body :global(em) {
		font-style: italic;
	}

  .body :global(blockquote) {
    margin: var(--space-stack) 0 0;
    padding: 0.25em 1em;
    border-left: 2px solid var(--color-border);
  }

  .body :global(blockquote p) {
    font-size: 0.875em;
    line-height: 1.7;
  }

	.post--titled h2,
  .post--link h2 {
		font-size: var(--size-lede);
		line-height: 1.4;
	}

	.post--link h2 a {
		text-decoration: none;
	}

	.post--link h2 a:hover {
		text-decoration: underline;
	}

	.post--link .link-marker {
		color: var(--color-ink-soft);
	}

	.rail {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
	}

  .rail a {
    font-style: italic;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
    text-decoration: none;
    &:hover {
		  text-decoration: underline;
    }
  }

	@media (max-width: 640px) {
		.post {
			grid-template-columns: 1fr;
			gap: 0 var(--space-stack);
		}
		.rail {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: baseline;
			justify-content: flex-start;
      gap: 0 var(--space-stack);
      padding-top: var(--space-stack);
		}
	}
</style>
