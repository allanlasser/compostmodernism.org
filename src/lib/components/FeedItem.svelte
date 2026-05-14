<script lang="ts">
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
	}

	let { item }: Props = $props();
</script>

{#if item.url}
	<article class="post post--link">
		<h2>
			<a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
			<span class="link-marker" aria-hidden="true">→</span>
		</h2>
		{#if item.body}<p>{item.body}</p>{/if}
		{#if item.tags?.length}
			<ul class="tags">
				{#each item.tags as tag (tag.slug)}
					<li><a href="/tag/{tag.slug}">{tag.name}</a></li>
				{/each}
			</ul>
		{/if}
		<a class="permalink" href={item.permalink}>
			<time>{new Date(item.date).toLocaleDateString()}</time>
		</a>
	</article>
{:else if item.title}
	<article class="post post--titled">
		<h2>{item.title}</h2>
		<p>{item.body}</p>
		{#if item.tags?.length}
			<ul class="tags">
				{#each item.tags as tag (tag.slug)}
					<li><a href="/tag/{tag.slug}">{tag.name}</a></li>
				{/each}
			</ul>
		{/if}
		<a class="permalink" href={item.permalink}>
			<time>{new Date(item.date).toLocaleDateString()}</time>
		</a>
	</article>
{:else}
	<article class="post post--plain">
		<p>{item.body}</p>
		{#if item.tags?.length}
			<ul class="tags">
				{#each item.tags as tag (tag.slug)}
					<li><a href="/tag/{tag.slug}">{tag.name}</a></li>
				{/each}
			</ul>
		{/if}
		<a class="permalink" href={item.permalink}>
			<time>{new Date(item.date).toLocaleDateString()}</time>
		</a>
	</article>
{/if}
