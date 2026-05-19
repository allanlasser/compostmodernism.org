<script lang="ts">
	import FeedItem from '$lib/components/FeedItem.svelte';
  import type { Post } from '$lib/types';

	interface Props {
		data: {
			tag: string;
			feed: Post[];
		};
	}

	let { data }: Props = $props();
</script>

<div class="feed">
	<h1 class="tag-heading">{data.tag}</h1>

	{#each data.feed as item (item.slug)}
		<FeedItem {item} />
	{/each}
</div>

<style>
	.feed {
		display: flex;
		flex-direction: column;
		gap: var(--space-gap);
	}

	.tag-heading {
    font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-title);
		color: var(--color-ink-soft);
	}

  .tag-heading::before {
    content: '#';
  }
</style>
