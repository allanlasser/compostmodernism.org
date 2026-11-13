<script lang="ts">
	import FeedItem from '$lib/components/FeedItem.svelte';
	import SocialMeta from '$lib/components/SocialMeta.svelte';
	import { placeSocialMeta } from '$lib/social';
	import type { Place, Post } from '$lib/types';

	interface Props {
		data: {
			place: Place;
			feed: Post[];
			siteUrl: string;
		};
	}

	let { data }: Props = $props();
</script>

<SocialMeta meta={placeSocialMeta(data.siteUrl, data.place)} />

<div class="feed">
	<h1 class="place-heading">{data.place.name}</h1>

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

	.place-heading {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-title);
		color: var(--color-ink-soft);
	}
</style>
