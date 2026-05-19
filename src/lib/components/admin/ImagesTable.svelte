<script lang="ts">
  import type { Image } from '$lib/types';
	import { untrack } from 'svelte';

	interface Props {
		images: Image[];
	}

	let { images }: Props = $props();

	type Meta = { title: string; alt: string; caption: string; credit: string };

	let local = $state<Image[]>(untrack(() => images.map((r) => ({ ...r }))));
	let deleted = $state<Set<number>>(new Set());
	let editing = $state<number | null>(null);
	let drafts = $state<Record<number, Meta>>({});
	let saving = $state<Set<number>>(new Set());
	let replacing = $state<Set<number>>(new Set());
	let copied = $state<Set<number>>(new Set());
	let copyTimers = new Map<number, ReturnType<typeof setTimeout>>();
	let fileInputs = $state<Record<number, HTMLInputElement | undefined>>({});

	const visible = $derived(local.filter((r) => !deleted.has(r.id)));

	function metaFrom(r: Image): Meta {
		return {
			title: r.title ?? '',
			alt: r.alt ?? '',
			caption: r.caption ?? '',
			credit: r.credit ?? ''
		};
	}

	function startEdit(r: Image) {
		drafts[r.id] = metaFrom(r);
		editing = r.id;
	}

	function cancelEdit() {
		editing = null;
	}

	async function saveEdit(r: Image) {
		const d = drafts[r.id];
		if (!d) return;
		saving.add(r.id);
		saving = new Set(saving);
		const payload = {
			title: d.title.trim() || null,
			alt: d.alt.trim() || null,
			caption: d.caption.trim() || null,
			credit: d.credit.trim() || null
		};
		const res = await fetch(`/api/images/${r.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		saving.delete(r.id);
		saving = new Set(saving);
		if (res.ok) {
			const j = (await res.json()) as { image: Partial<Image> };
			local = local.map((row) =>
				row.id === r.id ? { ...row, ...j.image } : row
			);
			editing = null;
		} else {
			window.alert('Could not save changes.');
		}
	}

	async function copyUrl(r: Image) {
		try {
			await navigator.clipboard.writeText(r.url);
			copied.add(r.id);
			copied = new Set(copied);
			const existing = copyTimers.get(r.id);
			if (existing) clearTimeout(existing);
			copyTimers.set(
				r.id,
				setTimeout(() => {
					copied.delete(r.id);
					copied = new Set(copied);
				}, 1500)
			);
		} catch {
			window.prompt('Copy this URL:', r.url);
		}
	}

	function triggerReplace(r: Image) {
		fileInputs[r.id]?.click();
	}

	async function onReplaceChosen(r: Image, e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		replacing.add(r.id);
		replacing = new Set(replacing);
		const form = new FormData();
		form.append('image', file);
		const res = await fetch(`/api/images/${r.id}/replace`, { method: 'POST', body: form });
		replacing.delete(r.id);
		replacing = new Set(replacing);
		if (res.ok) {
			local = local.map((row) =>
				row.id === r.id ? { ...row, uploaded_at: Date.now() } : row
			);
		} else {
			window.alert('Replace failed.');
		}
	}

	async function remove(r: Image) {
		const label = r.title ?? r.key;
		if (!window.confirm(`Delete "${label}"? This also removes the file from R2.`)) return;
		let res = await fetch(`/api/images/${r.id}`, { method: 'DELETE' });
		if (res.status === 409) {
			const j = (await res.json()) as { posts?: { slug: string; title: string | null }[] };
			const list = (j.posts ?? []).map((p) => `· ${p.title ?? p.slug}`).join('\n');
			const ok = window.confirm(
				`"${label}" is used by ${j.posts?.length ?? 'one or more'} post(s):\n${list}\n\nReplace is usually safer — it keeps the URL working. Delete anyway?`
			);
			if (!ok) return;
			res = await fetch(`/api/images/${r.id}?force=true`, { method: 'DELETE' });
		}
		if (res.ok) {
			deleted.add(r.id);
			deleted = new Set(deleted);
		} else {
			window.alert(`Could not delete "${label}".`);
		}
	}
</script>

<table class="images-table">
	<thead>
		<tr>
			<th scope="col">Image</th>
			<th scope="col">Uploaded</th>
			<th scope="col">Used by</th>
			<th scope="col">Metadata</th>
			<th scope="col" class="actions-head"><span class="sr-only">Actions</span></th>
		</tr>
	</thead>
	<tbody>
		{#each visible as r (r.id)}
			<tr>
				<td class="thumb-cell">
					<a href={r.url} target="_blank" rel="noopener noreferrer">
						<img src={r.url} alt={r.alt ?? ''} class="thumb" loading="lazy" />
					</a>
					<div class="key">{r.key}</div>
				</td>
				<td class="date-cell">
					<time datetime={new Date(r.uploaded_at).toISOString()}>
						{new Date(r.uploaded_at).toLocaleDateString()}
					</time>
				</td>
				<td class="usage-cell">
					{r.usage_count === 0 ? '—' : `${r.usage_count} post${r.usage_count === 1 ? '' : 's'}`}
				</td>
				<td class="meta-cell">
					{#if editing === r.id}
						<div class="meta-edit">
							<label>
								Title <input type="text" bind:value={drafts[r.id].title} />
							</label>
							<label>
								Alt <input type="text" bind:value={drafts[r.id].alt} />
							</label>
							<label>
								Caption <input type="text" bind:value={drafts[r.id].caption} />
							</label>
							<label>
								Credit <input type="text" bind:value={drafts[r.id].credit} />
							</label>
							<div class="meta-edit-actions">
								<button type="button" class="link" onclick={cancelEdit}>Cancel</button>
								<button type="button" onclick={() => saveEdit(r)} disabled={saving.has(r.id)}>
									{saving.has(r.id) ? 'Saving…' : 'Save'}
								</button>
							</div>
						</div>
					{:else}
						<div class="meta-summary">
							{#if r.title}<div><span class="meta-key">Title:</span> {r.title}</div>{/if}
							{#if r.alt}<div><span class="meta-key">Alt:</span> {r.alt}</div>{/if}
							{#if r.caption}<div><span class="meta-key">Caption:</span> {r.caption}</div>{/if}
							{#if r.credit}<div><span class="meta-key">Credit:</span> {r.credit}</div>{/if}
							{#if !r.title && !r.alt && !r.caption && !r.credit}<span class="muted">No metadata</span>{/if}
						</div>
					{/if}
				</td>
				<td class="actions-cell">
					<button type="button" class="link" onclick={() => copyUrl(r)}>
						{copied.has(r.id) ? 'Copied ✓' : 'Copy URL'}
					</button>
					{#if editing === r.id}
						<button type="button" class="link" onclick={cancelEdit}>Close</button>
					{:else}
						<button type="button" class="link" onclick={() => startEdit(r)}>Edit</button>
					{/if}
					<button type="button" class="link" onclick={() => triggerReplace(r)} disabled={replacing.has(r.id)}>
						{replacing.has(r.id) ? 'Replacing…' : 'Replace'}
					</button>
					<input
						type="file"
						accept="image/*"
						class="hidden-file"
						bind:this={fileInputs[r.id]}
						onchange={(e) => onReplaceChosen(r, e)}
					/>
					<button type="button" class="link delete" onclick={() => remove(r)}>Delete</button>
				</td>
			</tr>
		{/each}
	</tbody>
</table>

{#if visible.length === 0}
	<p class="empty">No images yet.</p>
{/if}

<style>
	.images-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--size-meta);
	}

	.images-table th,
	.images-table td {
		text-align: left;
		padding: var(--space-stack) 0.5em;
		vertical-align: top;
		border-bottom: 1px solid rgb(79 36 19 / 0.12);
	}

	.images-table thead th {
		font-style: italic;
		color: var(--color-ink-soft);
		font-weight: normal;
	}

	.thumb {
		display: block;
		width: 96px;
		height: 96px;
		object-fit: cover;
		background: rgb(79 36 19 / 0.06);
	}

	.key {
		margin-top: 0.25em;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 11px;
		color: var(--color-ink-soft);
		word-break: break-all;
	}

	.date-cell,
	.usage-cell {
		color: var(--color-ink-soft);
		white-space: nowrap;
	}

	.meta-summary div {
		margin-bottom: 2px;
	}

	.meta-key {
		font-style: italic;
		color: var(--color-ink-soft);
	}

	.meta-edit {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
	}

	.meta-edit label {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		color: var(--color-ink-soft);
	}

	.meta-edit input {
		font: inherit;
		padding: 0.3em 0.5em;
	}

	.meta-edit-actions {
		display: flex;
		gap: var(--space-stack);
		justify-content: flex-end;
	}

	.actions-cell {
		text-align: right;
		white-space: nowrap;
	}

	.actions-cell .link {
		display: inline-block;
		margin-left: var(--space-stack);
		font: inherit;
		font-style: italic;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: inherit;
	}

	.actions-cell .link.delete {
		color: #a13c1f;
	}

	.actions-cell .link:hover:not(:disabled) {
		text-decoration: underline;
	}

	.hidden-file {
		display: none;
	}

	.muted {
		color: rgb(79 36 19 / 0.4);
	}

	.empty {
		font-style: italic;
		color: var(--color-ink-soft);
		padding: var(--space-stack) 0;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
