<script lang="ts">
	import { untrack } from 'svelte';
	import FeedItem from '$lib/components/FeedItem.svelte';
	import SocialMeta from '$lib/components/SocialMeta.svelte';
	import { siteSocialMeta } from '$lib/social';
  import type { Post } from '$lib/types';
	
	interface Props {
		data: { feed: Post[]; siteUrl: string };
	}

	let { data }: Props = $props();

	let feed = $state<Post[]>(untrack(() => [...data.feed]));
	
</script>

<SocialMeta meta={siteSocialMeta(data.siteUrl, '/')} />

<div class="feed">
	{#each feed as item (item.slug)}
		<FeedItem {item} />
	{/each}
</div>

<style>
	.feed {
		display: flex;
		flex-direction: column;
		gap: calc(1.5 * var(--space-gap));
    padding-top: var(--space-header);
	}
</style>
