<script lang="ts">
	import { untrack } from 'svelte';
	import FeedItem from '$lib/components/FeedItem.svelte';
	import SocialMeta from '$lib/components/SocialMeta.svelte';
	import { siteSocialMeta } from '$lib/social';
  import type { Post } from '$lib/types';
	
	interface Props {
		data: { feed: Post[]; siteUrl: string; nextOffset?: number | null };
	}

	let { data }: Props = $props();

	let feed = $state<Post[]>(untrack(() => [...data.feed]));
	let nextOffset = $state<number | null>(untrack(() => data.nextOffset ?? null));
	let loading = $state(false);
	let failed = $state(false);
	let sentinel = $state<HTMLElement | null>(null);

	async function loadMore() {
		if (loading || nextOffset === null) return;
		loading = true;
		failed = false;
		try {
			const res = await fetch(`/api/feed?offset=${nextOffset}`);
			if (!res.ok) throw new Error(`feed responded ${res.status}`);
			const page = (await res.json()) as { posts: Post[]; nextOffset: number | null };
			// A post published mid-scroll shifts every offset by one, so drop repeats.
			const seen = new Set(feed.map((p) => p.slug));
			feed = [...feed, ...page.posts.filter((p) => !seen.has(p.slug))];
			nextOffset = page.nextOffset;
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	// Re-created after every page: an observer only reports changes, so a sentinel
	// that is still on screen after an append would otherwise never fire again.
	$effect(() => {
		void feed.length;
		if (!sentinel || failed) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) loadMore();
			},
			{ rootMargin: '800px 0px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

<SocialMeta meta={siteSocialMeta(data.siteUrl, '/')} />

<div class="feed">
	{#each feed as item (item.slug)}
		<FeedItem {item} />
	{/each}
	{#if nextOffset !== null}
		<div class="feed-more" bind:this={sentinel}>
			{#if failed}
				<button type="button" onclick={loadMore}>Couldn’t load older posts. Retry</button>
			{:else if loading}
				<span role="status">Loading older posts…</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.feed {
		display: flex;
		flex-direction: column;
		gap: calc(1.5 * var(--space-gap));
    padding-top: var(--space-header);
	}

	.feed-more {
		min-height: 1px;
		padding-bottom: var(--space-header);
		text-align: center;
	}
</style>
