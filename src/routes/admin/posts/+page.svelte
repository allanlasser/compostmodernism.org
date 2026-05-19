<script lang="ts">
	import PostsTable from '$lib/components/admin/PostsTable.svelte';

	interface AdminPost {
		slug: string;
		body: string;
		title: string | null;
		date: number;
		tags: { name: string; slug: string }[];
		permalink: string;
	}

	interface Props {
		data: {
			posts: AdminPost[];
			page: number;
			perPage: number;
			total: number;
			totalPages: number;
		};
	}

	let { data }: Props = $props();
</script>

<header class="posts-header">
	<h1>Posts</h1>
	<a class="new-post" href="/admin/posts/new">+ New post</a>
</header>

<PostsTable posts={data.posts} />

{#if data.totalPages > 1}
	<nav class="pager" aria-label="Pagination">
		{#if data.page > 1}
			<a href="?page={data.page - 1}" rel="prev">← Prev</a>
		{:else}
			<span class="muted">← Prev</span>
		{/if}
		<span class="status">Page {data.page} of {data.totalPages} · {data.total} posts</span>
		{#if data.page < data.totalPages}
			<a href="?page={data.page + 1}" rel="next">Next →</a>
		{:else}
			<span class="muted">Next →</span>
		{/if}
	</nav>
{:else}
	<p class="status">{data.total} {data.total === 1 ? 'post' : 'posts'}</p>
{/if}

<style>
	.posts-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-stack);
	}

	.posts-header h1 {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-title);
	}

	.new-post {
		text-decoration: none;
		font-style: italic;
	}

	.new-post:hover {
		text-decoration: underline;
	}

	.pager {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-stack);
		padding-top: var(--space-stack);
		font-size: var(--size-meta);
	}

	.pager a {
		text-decoration: none;
		font-style: italic;
	}

	.pager a:hover {
		text-decoration: underline;
	}

	.pager .status,
	.status {
		color: var(--color-ink-soft);
		font-size: var(--size-meta);
	}

	.muted {
		color: rgb(79 36 19 / 0.4);
		font-size: var(--size-meta);
	}
</style>
