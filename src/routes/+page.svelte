<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import FeedItem from '$lib/components/FeedItem.svelte';
	import PostForm from '$lib/components/admin/PostForm.svelte';
	import { permalink, slugify } from '$lib/slug';

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
		data: { feed: FeedItemData[] };
	}

	let { data }: Props = $props();
	const admin = $derived(Boolean(page.data.admin));

	let feed = $state<FeedItemData[]>(untrack(() => [...data.feed]));
	let composing = $state(false);

	function onCreated(
		slug: string,
		payload: { body: string; title: string | null; url: string | null; tags: string[] }
	) {
		const created_at = Date.now();
		feed = [
			{
				slug,
				body: payload.body,
				title: payload.title,
				url: payload.url,
				date: created_at,
				tags: payload.tags.map((name) => ({ name, slug: slugify(name) })),
				permalink: permalink({ slug, created_at })
			},
			...feed
		];
		composing = false;
	}
</script>

<div class="feed">
	{#if admin}
		{#if composing}
			<article class="post post--compose">
				<div class="content">
					<PostForm
						mode="create"
						onSuccess={onCreated}
						onCancel={() => (composing = false)}
					/>
				</div>
				<aside class="rail" aria-hidden="true"></aside>
			</article>
		{:else}
			<button
				type="button"
				class="compose-toggle"
				onclick={() => (composing = true)}
			>
				+ New post
			</button>
		{/if}
	{/if}

	{#each feed as item (item.slug)}
		<FeedItem {item} {admin} />
	{/each}
</div>

<style>
	.feed {
		display: flex;
		flex-direction: column;
		gap: var(--space-gap);
	}

	.post--compose {
		display: grid;
		grid-template-columns: 1fr var(--space-rail);
		gap: var(--space-gap);
	}

	.compose-toggle {
		align-self: flex-start;
		font: inherit;
		font-style: italic;
		font-size: var(--size-meta);
		background: transparent;
		border: 1px dashed rgb(79 36 19 / 0.3);
		padding: var(--space-stack) var(--space-gap);
		cursor: pointer;
		color: var(--color-ink-soft);
		width: 100%;
		text-align: center;
	}

	.compose-toggle:hover {
		color: var(--color-ink);
		border-color: rgb(79 36 19 / 0.6);
	}

	@media (max-width: 640px) {
		.post--compose {
			grid-template-columns: 1fr;
			gap: var(--space-stack);
		}
	}
</style>
