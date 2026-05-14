<script lang="ts">
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
</script>

<main>
	<h1>#{data.tag}</h1>

	{#each data.feed as item (item.slug)}
		<FeedItem {item} />
	{/each}
</main>
