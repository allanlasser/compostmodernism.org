<script lang="ts">
interface Props {
  tags: { name: string; slug: string }[];
}

const { tags }: Props = $props();
</script>

{#if tags.length}
  <ul class="tags">
    {#each tags as tag (tag.slug)}
      <li><a href="/tag/{tag.slug}">{tag.name}</a></li>
    {/each}
  </ul>
{/if}

<style>
  .tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.75em;
		font-style: italic;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

	.tags a {
		text-decoration: none;
	}

	.tags a::before {
		content: '#';
	}

	.tags a:hover {
		text-decoration: underline;
	}
</style>