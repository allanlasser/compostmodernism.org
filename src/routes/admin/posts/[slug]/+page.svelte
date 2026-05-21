<script lang="ts">
	import PostForm from '$lib/components/admin/PostForm.svelte';

	interface PostData {
		slug: string;
		body: string;
		title: string | null;
		url: string | null;
		tags: { name: string; slug: string }[];
		permalink: string;
		shortlink: string;
		date: number;
	}

	interface Props {
		data: { post: PostData };
	}

	let { data }: Props = $props();
</script>

<header class="edit-header">
	<h1>Edit post</h1>
  <p class="meta">
    <a href={data.post.permalink} target="_blank" rel="noopener noreferrer">{data.post.permalink}</a>
    · <a href={data.post.shortlink} target="_blank" rel="noopener noreferrer">{data.post.shortlink}</a>
    · <time datetime={new Date(data.post.date).toISOString()}>
      {new Date(data.post.date).toLocaleDateString()}
    </time>
  </p>
</header>

<PostForm mode="edit" initial={data.post} />

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

	.meta a {
		text-decoration: none;
		font-style: italic;
	}

	.meta a:hover {
		text-decoration: underline;
	}

	.meta {
		color: var(--color-ink-soft);
		font-size: var(--size-meta);
	}
</style>
