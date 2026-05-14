<script lang="ts">
	import FeedItem from '$lib/components/FeedItem.svelte';
	interface Props {
		data: {
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
</script>

<main>
	{#each data.feed as item (item.slug)}
		<FeedItem {item} />
	{/each}
</main>
