<script lang="ts">
	import type { PostPreview } from '$lib/preview';

	interface Row {
		slug: string;
		body: string;
		title: string | null;
		date: number;
		tags: { name: string; slug: string }[];
		permalink: string;
		preview: PostPreview;
	}

	interface Props {
		posts: Row[];
	}

	let { posts }: Props = $props();
</script>

<table class="posts-table">
	<thead>
		<tr>
			<th scope="col">Post</th>
			<th scope="col">Date</th>
			<th scope="col">Tags</th>
		</tr>
	</thead>
	<tbody>
		{#each posts as post (post.slug)}
			<tr>
				<td class="post-cell">
					<a href="/admin/posts/{post.slug}" class="post-link">
						{#if post.preview.image}
							<img class="thumb" src={post.preview.image.src} alt={post.preview.image.alt} loading="lazy" />
						{/if}
						{#if post.title}
							<span class="post-text post-title">{post.title}</span>
						{:else if post.preview.text}
							<span class="post-text">{post.preview.text}</span>
						{/if}
					</a>
				</td>
				<td class="date-cell">
					<time datetime={new Date(post.date).toISOString()}>
						{new Date(post.date).toLocaleDateString()}
					</time>
				</td>
				<td class="tags-cell">
					{#if post.tags.length}
						{post.tags.map((t) => '#' + t.slug).join(' ')}
					{:else}
						<span class="muted">—</span>
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

{#if posts.length === 0}
	<p class="empty">No posts yet.</p>
{/if}

<style>
	.posts-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--size-meta);
	}

	.posts-table th,
	.posts-table td {
		text-align: left;
		padding: var(--space-stack) 0.5em;
		vertical-align: top;
		border-bottom: 1px solid var(--color-border);
	}

	.posts-table thead th {
		font-style: italic;
		color: var(--color-ink-soft);
		font-weight: normal;
	}
  
  .post-cell {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .post-title {
    font-weight: 600;
  }

	.post-link {
		display: block;
		font-weight: 500;
		font-size: var(--size-body);
	}

	.thumb {
		display: block;
		width: 100%;
		max-width: 16rem;
		height: 4rem;
		object-fit: cover;
		border-radius: 2px;
	}

	.post-text {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.thumb + .post-text {
		margin-top: 0.35em;
	}


	.date-cell {
		color: var(--color-ink-soft);
		white-space: nowrap;
	}

	.tags-cell {
		color: var(--color-ink-soft);
		font-family: var(--font-display);
		font-style: italic;
	}

	@media (max-width: 640px) {
		.posts-table {
			font-size: 13px;
			line-height: 1.35;
		}

		.posts-table th,
		.posts-table td {
			padding: 0.5em 0.35em;
		}

		.post-cell {
			white-space: normal;
		}

		.post-link {
			font-size: 14px;
		}

		.post-text {
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			overflow: hidden;
			overflow-wrap: anywhere;
		}
	}

	.muted {
		color: var(--color-ink-dim);
	}

	.empty {
		font-style: italic;
		color: var(--color-ink-soft);
		padding: var(--space-stack) 0;
	}
</style>
