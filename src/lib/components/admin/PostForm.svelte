<script lang="ts">
	import { untrack } from 'svelte';
	import { postInputSchema, type PostInputParsed } from '$lib/schemas';
	import ImageUploadModal from './ImageUploadModal.svelte';

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
		onCancel?: () => void;
		/** When true, the in-form body toolbar and actions row are not rendered.
		 * The host is responsible for providing Save/Cancel/Insert-image controls,
		 * typically targeting the form via `form={formId}` and binding to the
		 * exposed `imageModalOpen` / `submitting` / `saved` props. */
		hideActions?: boolean;
		/** Optional id applied to the <form> element so external submit buttons
		 * can reference it via the HTML `form` attribute. */
		formId?: string;
		imageModalOpen?: boolean;
		submitting?: boolean;
		saved?: boolean;
	}

	let {
		mode,
		initial = {},
		onSuccess,
		onCancel,
		hideActions = false,
		formId,
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

		try {
			const res = await fetch(url2, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(parsed.data)
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
		submitting ? (mode === 'create' ? 'Posting…' : 'Saving…') : saved ? 'Saved ✓' : mode === 'create' ? 'Post' : 'Save'
	);
</script>

<form id={formId} class="post-form" onsubmit={submit} novalidate>
	<label>
		Title
		<input type="text" bind:value={title} disabled={submitting} />
		{#if fieldErrors.title}<span class="field-error">{fieldErrors.title}</span>{/if}
	</label>

	<label>
		URL <span class="hint">(for link posts)</span>
		<input type="url" bind:value={url} disabled={submitting} />
		{#if fieldErrors.url}<span class="field-error">{fieldErrors.url}</span>{/if}
	</label>

	<label>
		Tags <span class="hint">(comma-separated)</span>
		<input
			type="text"
			bind:value={tags}
			placeholder="food, travel, tech"
			disabled={submitting}
		/>
		{#if fieldErrors.tags}<span class="field-error">{fieldErrors.tags}</span>{/if}
	</label>

	<label>
		Body
		<textarea
			rows="10"
			bind:value={body}
			bind:this={bodyTextarea}
			disabled={submitting}
		></textarea>
		{#if fieldErrors.body}<span class="field-error">{fieldErrors.body}</span>{/if}
	</label>
	{#if !hideActions}
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
	{/if}

	{#if formError}
		<p class="form-error" role="alert">{formError}</p>
	{/if}

	{#if !hideActions}
		<div class="actions">
			{#if onCancel}
				<button type="button" class="link cancel" onclick={onCancel} disabled={submitting}>
					Cancel
				</button>
			{/if}
			<button type="submit" disabled={submitting}>{buttonLabel}</button>
		</div>
	{/if}
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
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
	}

	.post-form label {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

	.post-form input,
	.post-form textarea,
	.post-form button {
		font: inherit;
		padding: 0.4em 0.6em;
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
		color: #a13c1f;
		font-size: var(--size-meta);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-stack);
	}

	.actions button[type='submit'] {
		min-width: 6em;
	}

	.actions .link.cancel,
	.body-toolbar .link {
		font: inherit;
		font-style: italic;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: var(--color-ink-soft);
	}

	.actions .link.cancel:hover:not(:disabled),
	.body-toolbar .link:hover:not(:disabled) {
		color: var(--color-ink);
		text-decoration: underline;
	}

	.body-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.25em;
	}
</style>
