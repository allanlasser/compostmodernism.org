<script lang="ts">
	import { untrack } from 'svelte';
	import FeedItem from '$lib/components/FeedItem.svelte';
  import type { Post } from '$lib/types';
	
	interface Props {
		data: { feed: Post[] };
	}

	let { data }: Props = $props();

	let feed = $state<Post[]>(untrack(() => [...data.feed]));
	
</script>

<div class="feed">
	{#each feed as item (item.slug)}
		<FeedItem {item} />
	{/each}
</div>

<style>
	.feed {
		display: flex;
		flex-direction: column;
		gap: var(--space-gap);
    padding-top: var(--space-header);
	}
</style>
