<script lang="ts">
	interface Props {
		data: {
		post: {
			slug: string;
			body: string;
			title: string | null;
			url: string | null;
			date: number;
			tags: { name: string; slug: string }[];
			permalink: string;
		};
	};
	}

	let { data }: Props = $props();
	let post = $derived(data.post);
</script>

<article class="post post--single">
	{#if post.url}
		<h1>
			<a href={post.url} target="_blank" rel="noopener noreferrer">{post.title}</a>
			<span class="link-marker" aria-hidden="true">→</span>
		</h1>
	{:else if post.title}
		<h1>{post.title}</h1>
	{/if}

	<p>{post.body}</p>

	{#if post.tags.length}
		<ul class="tags">
			{#each post.tags as tag (tag.slug)}
				<li><a href="/tag/{tag.slug}">{tag.name}</a></li>
			{/each}
		</ul>
	{/if}

	<time>{new Date(post.date).toLocaleDateString()}</time>
</article>
