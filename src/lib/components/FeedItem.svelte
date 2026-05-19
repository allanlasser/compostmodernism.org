<script lang="ts">
	import { untrack } from 'svelte';
	import Dateline from './Dateline.svelte';
	import TagList from './TagList.svelte';
	import PostForm from './admin/PostForm.svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { slugify } from '$lib/slug';

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
		admin?: boolean;
	}

	let { item, admin = false }: Props = $props();

	let post = $state<FeedItemData>(untrack(() => ({ ...item, tags: [...item.tags] })));
	let editing = $state(false);
	let imageModalOpen = $state(false);
	let submitting = $state(false);
	let saved = $state(false);
	let bodyHtml = $derived(renderMarkdown(post.body));
	const formId = $derived(`feeditem-form-${post.slug}`);
	const saveLabel = $derived(submitting ? 'Saving…' : saved ? 'Saved ✓' : 'Save');

	function onSaved(
		_slug: string,
		payload: { body: string; title: string | null; url: string | null; tags: string[] }
	) {
		post = {
			...post,
			body: payload.body,
			title: payload.title,
			url: payload.url,
			tags: payload.tags.map((name) => ({ name, slug: slugify(name) }))
		};
		editing = false;
	}
</script>

<article
	class="post"
	class:post--link={post.url}
	class:post--titled={!post.url && post.title}
	class:post--plain={!post.url && !post.title}
	class:post--editing={editing}
>
	<div class="content">
		{#if editing}
			<PostForm
				mode="edit"
				initial={post}
				onSuccess={onSaved}
				onCancel={() => (editing = false)}
				hideActions
				{formId}
				bind:imageModalOpen
				bind:submitting
				bind:saved
			/>
		{:else}
			{#if post.title}
				<h2>
					{#if post.url}
						<a href={post.url} target="_blank" rel="noopener noreferrer">
							{post.title} <span class="link-marker" aria-hidden="true">➻</span>
						</a>
					{:else}
						{post.title}
					{/if}
				</h2>
			{/if}
			<div class="body">{@html bodyHtml}</div>
		{/if}
	</div>

	<aside class="rail">
		{#if editing}
			<div class="rail-actions">
				<button
					type="submit"
					form={formId}
					class="save"
					disabled={submitting}
				>
					{saveLabel}
				</button>
				<button
					type="button"
					class="cancel"
					onclick={() => (editing = false)}
					disabled={submitting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="insert-image"
					onclick={() => (imageModalOpen = true)}
					disabled={submitting}
				>
					Insert image
				</button>
			</div>
		{:else}
			<div class="rail-head">
				<a class="permalink" href={post.permalink}>
					<Dateline date={post.date} />
				</a>
				{#if admin}
					<button type="button" class="rail-edit" onclick={() => (editing = true)}>Edit</button>
				{/if}
			</div>
			<TagList tags={post.tags} />
		{/if}
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

	.rail-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5em;
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
		justify-content: flex-start;
		gap: var(--space-stack);
	}

	.rail-edit,
	.rail-actions button {
		font: inherit;
		font-style: italic;
		font-size: var(--size-meta);
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: var(--color-ink-soft);
		text-align: left;
	}

	.rail-edit:hover,
	.rail-actions button:hover:not(:disabled) {
		color: var(--color-ink);
		text-decoration: underline;
	}

	.rail-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
	}

	.rail-actions .save {
		font-style: normal;
		color: var(--color-ink);
		font-weight: 500;
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
