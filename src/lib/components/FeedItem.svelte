<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import Dateline from './Dateline.svelte';
	import TagList from './TagList.svelte';
	import Lightbox from './Lightbox.svelte';
	import { renderMarkdown } from '$lib/markdown';
  import type { Post } from '$lib/types';

	interface Props {
		item: Post;
    rail?: Snippet;
	}

	let { item, rail }: Props = $props();

	let post = $state<Post>(untrack(() => ({ ...item, tags: [...item.tags] })));
	let bodyHtml = $derived(renderMarkdown(post.body));

	type LightboxState = {
		src: string;
		alt: string;
		sourceRect: DOMRect;
		naturalWidth: number;
		naturalHeight: number;
		sourceEl: HTMLImageElement;
	};
	let lightbox = $state<LightboxState | null>(null);

	function onBodyClick(e: MouseEvent) {
		const target = e.target;
		if (!(target instanceof HTMLImageElement)) return;
		if (target.closest('a')) return;
		e.preventDefault();
		if (
			typeof window !== 'undefined' &&
			window.matchMedia('(max-width: 640px)').matches
		) {
			target.classList.toggle('is-tapped');
			return;
		}
		lightbox = {
			src: target.currentSrc || target.src,
			alt: target.alt,
			sourceRect: target.getBoundingClientRect(),
			naturalWidth: target.naturalWidth,
			naturalHeight: target.naturalHeight,
			sourceEl: target
		};
	}

	function closeLightbox() {
		lightbox = null;
	}
</script>

<article
	class="post"
	class:post--link={post.url}
	class:post--titled={!post.url && post.title}
	class:post--plain={!post.url && !post.title}
>
	<div class="content">
    {#if post.title}
      <h2>
        {#if post.url}
          <a href={post.url} target="_blank" rel="noopener noreferrer">
            {post.title} <span class="link-marker" aria-hidden="true">➻</span>
          </a>
        {:else}
          {post.title}
        {/if}
      </h2>
    {/if}
    <div
      class="body"
      role="presentation"
      onclick={onBodyClick}
      onkeydown={() => {}}
    >{@html bodyHtml}</div>
	</div>

	<aside class="rail">
    <a class="permalink" href={post.permalink}>
      <Dateline date={post.date} />
    </a>
    <TagList tags={post.tags} />
    {#if rail}{@render rail()}{/if}
	</aside>
</article>

{#if lightbox}
	<Lightbox
		src={lightbox.src}
		alt={lightbox.alt}
		sourceRect={lightbox.sourceRect}
		naturalWidth={lightbox.naturalWidth}
		naturalHeight={lightbox.naturalHeight}
		sourceEl={lightbox.sourceEl}
		onClose={closeLightbox}
	/>
{/if}

<style>
	.post {
		display: grid;
		grid-template-columns: 1fr var(--space-rail);
		gap: var(--space-gap);
    align-items: baseline;
		width: 100%;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
		min-width: 0;
	}

	.body :global(p) {
		font-size: var(--size-body);
		line-height: var(--leading-body);
		margin: 0;
	}

	.body :global(p + p) {
		margin-top: var(--space-stack);
	}

	.body :global(img) {
		display: block;
		max-width: 100%;
		height: auto;
		margin-top: var(--space-stack);
    border-radius: 4px;
    opacity: 0.8;
    cursor: zoom-in;
    transition: opacity .15s linear;
    &:hover {
      opacity: 1;
    }
	}

	.body :global(img.is-tapped) {
		opacity: 1;
	}

	.body :global(a img) {
		cursor: pointer;
	}

	.body :global(img[data-lightbox-source]) {
		visibility: hidden;
		opacity: 1;
		transition: none;
	}

	.body :global(a) {
		color: var(--color-ink-soft);
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
	}

  .body :global(a:hover) {
    color: var(--color-ink);
  }

	.body :global(strong) {
		font-weight: 600;
	}

	.body :global(em) {
		font-style: italic;
	}

  .body :global(blockquote) {
    margin: var(--space-stack) var(--space-stack) var(--space-stack) 0;
    padding: 0.825em 1.125em;
    border-radius: 4px;
    background: var(--color-surface-subtle);
  }

  .body :global(blockquote p) {
    font-size: 0.925em;
    line-height: 1.7;
  }

  .body :global(ul) {
    list-style-type: disc;
    margin: var(--space-stack) 0 var(--space-stack) 1.5em;
  }

  .body :global(ul li) {
    margin: 0.25em 0;
  }

  .body :global(ul li::marker) {
    color: var(--color-ink-soft);
  }

  .body :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75em;
    background: var(--color-surface-subtle);
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }

  .body :global(pre) {
    margin: var(--space-stack) 0;
    padding: 0.75em 1em;
    background: var(--color-surface-subtle);
    border-radius: 4px;
    overflow-x: auto;
    line-height: 1.4;
    tab-size: 2;
  }

  .body :global(pre code) {
    background: none;
    padding: 0;
    border-radius: 0;
  }

	.post--titled h2,
  .post--link h2 {
    font-family: var(--font-display);
    font-style: italic;
		font-size: var(--size-lede);
		line-height: 1.4;
	}

	.post--link h2 a {
		text-decoration: none;
	}

	.post--link h2 a:hover {
		text-decoration: underline;
    text-decoration-color: var(--color-ink-soft);
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
	}

	.post--link .link-marker {
		color: var(--color-ink-soft);
	}

	.rail {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
    align-items: baseline;
    gap: 0.125em;
	}

  .rail a {
    font-style: italic;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
    text-decoration: none;
    &:hover {
      color: var(--color-ink);
		  text-decoration: underline;
    }
  }

	@media (max-width: 640px) {
		.post {
			grid-template-columns: 1fr;
			gap: 0 var(--space-stack);
		}
		.rail {
      align-items: baseline;
			justify-content: flex-start;
      gap: 0 var(--space-stack);
      padding-top: var(--space-stack);
		}
		.body :global(img) {
			cursor: default;
		}
	}
</style>
