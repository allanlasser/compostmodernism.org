<script lang="ts">
	import { untrack } from 'svelte';
	import { postInputSchema, type PostInputParsed } from '$lib/schemas';
	import ImageUploadModal from './ImageUploadModal.svelte';
  import TrashIcon from '@lucide/svelte/icons/trash-2';
  import { LoaderCircle } from '@lucide/svelte';

	interface Initial {
		slug?: string;
		body?: string;
		title?: string | null;
		url?: string | null;
		tags?: { name: string }[] | string[];
	}

	interface Props {
		mode: 'create' | 'edit';
		initial?: Initial;
		onSuccess?: (slug: string, payload: PostInputParsed) => void;
		imageModalOpen?: boolean;
		submitting?: boolean;
		saved?: boolean;
	}

	let {
		mode,
		initial = {},
		onSuccess,
		imageModalOpen = $bindable(false),
		submitting = $bindable(false),
		saved = $bindable(false)
	}: Props = $props();

	function tagsToString(t: Initial['tags']): string {
		if (!t) return '';
		return t
			.map((x) => (typeof x === 'string' ? x : x.name))
			.join(', ');
	}

	let title = $state(untrack(() => initial.title ?? ''));
	let body = $state(untrack(() => initial.body ?? ''));
	let url = $state(untrack(() => initial.url ?? ''));
	let tags = $state(untrack(() => tagsToString(initial.tags)));
	let slug = $state(untrack(() => initial.slug ?? ''));

	let bodyTextarea: HTMLTextAreaElement | undefined = $state();

	function insertImageMarkdown(imageUrl: string) {
		const snippet = `![](${imageUrl})`;
		const el = bodyTextarea;
		if (!el) {
			body = body + (body && !body.endsWith('\n') ? '\n\n' : '') + snippet;
			return;
		}
		const start = el.selectionStart ?? body.length;
		const end = el.selectionEnd ?? body.length;
		body = body.slice(0, start) + snippet + body.slice(end);
		// Restore caret after the inserted snippet on the next tick.
		queueMicrotask(() => {
			el.focus();
			const caret = start + snippet.length;
			el.setSelectionRange(caret, caret);
		});
	}

	type FieldErrors = { body?: string; title?: string; url?: string; tags?: string };
	let fieldErrors = $state<FieldErrors>({});
	let formError = $state('');
	let savedTimer: ReturnType<typeof setTimeout> | undefined;

	function buildPayload() {
		return {
			body: body.trim(),
			title: title.trim() || null,
			url: url.trim() || null,
			tags: tags
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean)
		};
	}

	async function submit(e?: Event) {
		e?.preventDefault();
		if (submitting) return;
		fieldErrors = {};
		formError = '';

		const payload = buildPayload();
		const parsed = postInputSchema.safeParse(payload);
		if (!parsed.success) {
			const flat = parsed.error.flatten((i) => i.message).fieldErrors as Record<string, string[] | undefined>;
			fieldErrors = {
				body: flat.body?.[0],
				title: flat.title?.[0],
				url: flat.url?.[0],
				tags: flat.tags?.[0]
			};
			return;
		}
		if (parsed.data.url && !parsed.data.title) {
			formError = 'A link post needs a title.';
			return;
		}

		submitting = true;
		const url2 =
			mode === 'create' ? '/api/post' : `/api/post/${encodeURIComponent(initial.slug ?? '')}`;
		const method = mode === 'create' ? 'POST' : 'PATCH';

		const wirePayload: Record<string, unknown> = { ...parsed.data };
		const trimmedSlug = slug.trim();
		if (mode === 'edit' && trimmedSlug && trimmedSlug !== (initial.slug ?? '')) {
			wirePayload.slug = trimmedSlug;
		}

		try {
			const res = await fetch(url2, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(wirePayload)
			});
			if (!res.ok) {
				const j = (await res.json().catch(() => null)) as { error?: unknown } | null;
				formError = typeof j?.error === 'string' ? j.error : `Request failed (${res.status})`;
				return;
			}
			const j = (await res.json()) as { slug?: string };
			saved = true;
			if (savedTimer) clearTimeout(savedTimer);
			savedTimer = setTimeout(() => (saved = false), 2000);
			const resolvedSlug = j.slug ?? initial.slug ?? '';
			onSuccess?.(resolvedSlug, parsed.data);
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Network error';
		} finally {
			submitting = false;
		}
	}

	const buttonLabel = $derived(
		submitting ? (mode === 'create' ? 'Publishing…' : 'Saving…') : saved ? 'Saved ✓' : mode === 'create' ? 'Publish' : 'Save'
	);

  let deleting = $state(false);

	async function remove() {
    if (!initial.slug) {
      throw new Error('Missing slug!')
    }
		const label = title ?? initial.slug;
		if (!window.confirm(`Delete this post? This cannot be undone.`)) return;
		deleting = true;
		const res = await fetch(`/api/post/${encodeURIComponent(initial.slug)}`, {
			method: 'DELETE'
		});
		if (res.ok) {
			window.location.href = '/admin/posts';
		} else {
			deleting = false;
			window.alert(`Could not delete "${label}".`);
		}
	}
</script>

<form class="post-form" onsubmit={submit} novalidate>
  {#if formError}
    <p class="form-error" role="alert">{formError}</p>
  {/if}

  <label id="title">
    <input name="title" type="text" bind:value={title} disabled={submitting} placeholder="Untitled" />
    {#if fieldErrors.title}<span class="field-error">{fieldErrors.title}</span>{/if}
  </label>

  <label id="body">
    <div class="body-toolbar">
      <button
        type="button"
        class="link"
        onclick={() => (imageModalOpen = true)}
        disabled={submitting}
      >
        Insert image
      </button>
    </div>
    <textarea
      rows="10"
      bind:value={body}
      bind:this={bodyTextarea}
      disabled={submitting}
      placeholder="Start writing…"
    ></textarea>
    {#if fieldErrors.body}<span class="field-error">{fieldErrors.body}</span>{/if}
  </label>

  <div class="form-group">
    <label id="url">
      <span class="label">Link</span>
      <input type="url" bind:value={url} disabled={submitting} />
      {#if fieldErrors.url}<span class="field-error">{fieldErrors.url}</span>{/if}
    </label>

    <label id="tags">
      <span class="label">Tags <span class="hint">(comma-separated)</span></span>
      <input
        type="text"
        bind:value={tags}
        placeholder="food, travel, tech"
        disabled={submitting}
      />
      {#if fieldErrors.tags}<span class="field-error">{fieldErrors.tags}</span>{/if}
    </label>

    <label id="slug">
      <span class="label">Slug</span>
      <input
        type="text"
        name="slug"
        bind:value={slug}
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        disabled={submitting}
      />
    </label>
  </div>

  <div class="actions">
    <button id="save" type="submit" class="button" disabled={submitting}>{buttonLabel}</button>
    {#if mode === "edit"}
    <button type="button" class="ghost delete button" onclick={remove} disabled={deleting}>
      {#if deleting}
        <LoaderCircle size="16" />
      {:else}
        <TrashIcon size={16} />
      {/if}
    </button>
    {/if}
  </div>
</form>

{#if imageModalOpen}
	<ImageUploadModal
		onInsert={(url) => {
			insertImageMarkdown(url);
			imageModalOpen = false;
		}}
		onClose={() => (imageModalOpen = false)}
	/>
{/if}

<style>
	.post-form {
		display: grid;
		grid-template-columns: 1fr var(--space-rail);
		gap: var(--space-stack) var(--space-gap);
		width: 100%;
	}

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-stack);
    grid-column: 2/3;
  }

  #body, #title {
    grid-column: 1/2;
  }

  @media (max-width: 640px) {
    .post-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-stack);
    }
    .actions {
      position: sticky;
      bottom: 0;
      background: var(--color-bg);
      padding: 1em 0;
    }
  }

  #title input {
    font-family: var(--font-display);
    font-style: italic;
		font-size: var(--size-lede);
		line-height: 1.4;
    padding: 0.2em 0.6em;
    &::placeholder {
      color: var(--color-ink);
      opacity: 0.4;
    }
  }

  #body textarea {
    font-size: var(--size-body);
		line-height: var(--leading-body);
		margin: 0;
    &::placeholder {
      color: var(--color-ink);
      opacity: 0.4;
    }
  }

  #save {
    flex: 1 1 auto;
  }

	.post-form label {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

	.post-form input,
	.post-form textarea {
		font: inherit;
		padding: 0.4em 0.6em;
    background: var(--color-field);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    &:focus, &:hover {
      background: var(--color-field-focus);
    }
	}

	.post-form textarea {
		font-family: var(--font-serif);
		line-height: var(--leading-body);
		resize: vertical;
	}

	.hint {
		font-style: italic;
	}

	.field-error,
	.form-error {
		color: var(--color-danger);
		font-size: var(--size-meta);
	}

	.actions {
    grid-row: 1/2;
    grid-column: 2/3;
		display: flex;
		gap: var(--space-stack);
	}

	.body-toolbar .link {
    display: inline-block;
		font: inherit;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: var(--color-ink-soft);
	}

	.body-toolbar .link:hover:not(:disabled) {
		color: var(--color-ink);
		text-decoration: underline;
	}

	.body-toolbar {
		display: flex;
		justify-content: flex-end;
	}

  .button.delete {
    min-width: unset;
  }
</style>
