<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
  import FeedItem from '$lib/components/FeedItem.svelte';
  import type { Post } from '$lib/types';

	interface Props {
		data: { post: Post };
	}

	let { data }: Props = $props();

	let post = $state<Post>(untrack(() => ({ ...data.post, tags: [...data.post.tags] })));
	const admin = $derived(Boolean(page.data.admin));
</script>

{#snippet rail()}
{#if admin}
  <div class="admin-tools">
    <a href="/admin/posts/{post.slug}">Edit</a>
  </div>
{/if}
{/snippet}

<article class="post post--single">		
  <FeedItem item={post} {rail} />
</article>


<style>
  .admin-tools {
    margin: var(--space-stack) 0 0;
    display: flex;
  }

  .admin-tools a {
    font-size: var(--size-meta);
    color: var(--color-ink-soft);
    font-style: italic;
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }
</style>
