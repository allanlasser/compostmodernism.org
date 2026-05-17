<script lang="ts">
	import Dateline from '$lib/components/Dateline.svelte';
  import TagList from '$lib/components/TagList.svelte';
	import { renderMarkdown } from '$lib/markdown';

	interface Props {
		data: {
			post: {
				slug: string;
				body: string;
				title: string | null;
				url: string | null;
				date: number;
				tags: { name: string; slug: string }[];
				permalink: string;
			};
		};
	}

	let { data }: Props = $props();
	let post = $derived(data.post);
	let bodyHtml = $derived(renderMarkdown(post.body));
</script>

<article class="post post--single">
	<div class="content">
		{#if post.title}
      <h1>
        {#if post.url}
          <a href={post.url} target="_blank" rel="noopener noreferrer">
            {post.title} <span class="link-marker" aria-hidden="true">➻</span>
          </a>
        {:else}
          {post.title}
        {/if}
      </h1>
    {/if}
		<div class="body">{@html bodyHtml}</div>
    <Dateline date={post.date} />
	</div>

	<aside class="rail">
		<TagList tags={post.tags} />
	</aside>
</article>

<style>
	.post {
		display: grid;
		grid-template-columns: 1fr var(--space-rail);
		gap: var(--space-gap);
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
		min-width: 0;
	}

	h1 {
		font-size: var(--size-lede);
		line-height: var(--leading-lede);
	}

	h1 a {
		text-decoration: none;
	}

	h1 a:hover {
		text-decoration: underline;
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

	.link-marker {
		color: var(--color-ink-soft);
	}

	.rail {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	@media (max-width: 640px) {
		.post {
			grid-template-columns: 1fr;
			gap: var(--space-stack);
		}
		.rail {
			justify-content: flex-start;
		}
	}
</style>
