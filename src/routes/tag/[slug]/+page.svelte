<script lang="ts">
	import { page } from '$app/state';
	import FeedItem from '$lib/components/FeedItem.svelte';

	interface Props {
		data: {
			tag: string;
			feed: {
				slug: string;
				body: string;
				title: string | null;
				url: string | null;
				date: number;
				tags: { name: string; slug: string }[];
				permalink: string;
			}[];
		};
	}

	let { data }: Props = $props();
	const admin = $derived(Boolean(page.data.admin));
</script>

<div class="feed">
	<h1 class="tag-heading">#{data.tag}</h1>

	{#each data.feed as item (item.slug)}
		<FeedItem {item} {admin} />
	{/each}
</div>

<style>
	.feed {
		display: flex;
		flex-direction: column;
		gap: var(--space-gap);
	}

	.tag-heading {
		font-style: italic;
		font-size: var(--size-title);
		color: var(--color-ink-soft);
	}
</style>
