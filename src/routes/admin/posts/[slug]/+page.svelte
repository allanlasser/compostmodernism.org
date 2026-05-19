<script lang="ts">
	import PostForm from '$lib/components/admin/PostForm.svelte';

	interface PostData {
		slug: string;
		body: string;
		title: string | null;
		url: string | null;
		tags: { name: string; slug: string }[];
		permalink: string;
		date: number;
	}

	interface Props {
		data: { post: PostData };
	}

	let { data }: Props = $props();
	let deleting = $state(false);

	async function remove() {
		const label = data.post.title ?? data.post.slug;
		if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
		deleting = true;
		const res = await fetch(`/api/post/${encodeURIComponent(data.post.slug)}`, {
			method: 'DELETE'
		});
		if (res.ok) {
			window.location.href = '/admin/posts';
		} else {
			deleting = false;
			window.alert(`Could not delete "${label}".`);
		}
	}
</script>

<header class="edit-header">
	<h1>Edit post</h1>
	<a class="back" href="/admin/posts">← All posts</a>
</header>

<p class="meta">
	<a href={data.post.permalink} target="_blank" rel="noopener noreferrer">{data.post.permalink}</a>
	· <time datetime={new Date(data.post.date).toISOString()}>
		{new Date(data.post.date).toLocaleDateString()}
	</time>
</p>

<PostForm mode="edit" initial={data.post} />

<div class="danger-zone">
	<button type="button" class="delete" onclick={remove} disabled={deleting}>
		{deleting ? 'Deleting…' : 'Delete post'}
	</button>
</div>

<style>
	.edit-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-stack);
	}

	.edit-header h1 {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-title);
	}

	.back,
	.meta a {
		text-decoration: none;
		font-style: italic;
	}

	.back:hover,
	.meta a:hover {
		text-decoration: underline;
	}

	.meta {
		color: var(--color-ink-soft);
		font-size: var(--size-meta);
	}

	.danger-zone {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--space-stack);
		border-top: 1px solid rgb(79 36 19 / 0.12);
	}

	.danger-zone button.delete {
		font: inherit;
		font-style: italic;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: #a13c1f;
	}

	.danger-zone button.delete:hover:not(:disabled) {
		text-decoration: underline;
	}
</style>
