<script lang="ts">
	import Dateline from './Dateline.svelte';
  import TagList from './TagList.svelte';
	import { renderMarkdown } from '$lib/markdown';

	interface FeedItemData {
		slug: string;
		body: string;
		title: string | null;
		url: string | null;
		date: number;
		tags: { name: string; slug: string }[];
		permalink: string;
	}

  interface Props {
		item: FeedItemData;
	}

	let { item }: Props = $props();
	let bodyHtml = $derived(renderMarkdown(item.body));
</script>

<article
	class="post"
	class:post--link={item.url}
	class:post--titled={!item.url && item.title}
	class:post--plain={!item.url && !item.title}
>
	<div class="content">
    {#if item.title}
      <h2>
        {#if item.url}
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            {item.title} <span class="link-marker" aria-hidden="true">➻</span>
          </a>
        {:else}
          {item.title}
        {/if}
      </h2>
    {/if}
    <div class="body">{@html bodyHtml}</div>
    <a class="permalink" href={item.permalink}>
			<Dateline date={item.date} />
		</a>
	</div>

	<aside class="rail">
		<TagList tags={item.tags} />
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

	.permalink {
		text-decoration: none;
	}

	.permalink:hover {
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

	.post--titled h2 {
		font-size: var(--size-lede);
		line-height: var(--leading-lede);
	}

	.post--link h2 {
		font-size: var(--size-lede);
		line-height: var(--leading-lede);
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
		justify-content: flex-end;
	}

	@media (max-width: 640px) {
		.post {
			grid-template-columns: 1fr;
			gap: 0 var(--space-stack);
		}
		.rail {
			justify-content: flex-start;
		}
	}
</style>
