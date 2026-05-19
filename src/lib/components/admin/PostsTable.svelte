<script lang="ts">
	interface Row {
		slug: string;
		body: string;
		title: string | null;
		date: number;
		tags: { name: string; slug: string }[];
		permalink: string;
	}

	interface Props {
		posts: Row[];
	}

	let { posts }: Props = $props();

	function preview(p: Row): string {
		if (p.title) return p.title;
		const cleaned = p.body.replace(/\s+/g, ' ').trim();
		return cleaned.length > 80 ? cleaned.slice(0, 77) + '…' : cleaned;
	}
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
					<a href="/admin/posts/{post.slug}" class="post-link">{preview(post)}</a>
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
		border-bottom: 1px solid rgb(79 36 19 / 0.12);
	}

	.posts-table thead th {
		font-style: italic;
		color: var(--color-ink-soft);
		font-weight: normal;
	}

	.post-link {
		text-decoration: none;
		font-weight: 500;
		font-size: var(--size-body);
	}

	.post-link:hover {
		text-decoration: underline;
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

	.muted {
		color: rgb(79 36 19 / 0.4);
	}

	.empty {
		font-style: italic;
		color: var(--color-ink-soft);
		padding: var(--space-stack) 0;
	}
</style>
