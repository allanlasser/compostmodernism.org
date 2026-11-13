<script lang="ts">
	import PostForm from '$lib/components/admin/PostForm.svelte';
	import type { KnownPlace } from '$lib/types';

	interface Props {
		data?: { places?: KnownPlace[] };
	}

	let { data }: Props = $props();

	function onSuccess(slug: string) {
		if (slug) window.location.href = `/admin/posts/${slug}`;
	}
</script>

<header class="new-header">
	<h1>New post</h1>
	<a class="back" href="/admin/posts">← All posts</a>
</header>

<PostForm mode="create" {onSuccess} places={data?.places} />

<style>
	.new-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-stack);
	}

	.new-header h1 {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-title);
	}

	.back {
		text-decoration: none;
		font-style: italic;
	}

	.back:hover {
		text-decoration: underline;
	}
</style>
