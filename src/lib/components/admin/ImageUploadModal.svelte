<script lang="ts">
	interface Props {
		onInsert: (urls: string[]) => void;
		onClose: () => void;
	}

	let { onInsert, onClose }: Props = $props();

	let files = $state<File[]>([]);
	let uploading = $state(false);
	let uploadProgress = $state('');
	let error = $state('');

	function onPick(e: Event) {
		const input = e.target as HTMLInputElement;
		files = input.files ? Array.from(input.files) : [];
		error = '';
	}

	async function upload() {
		if (!files.length || uploading) return;
		uploading = true;
		error = '';
		const urls: string[] = [];
		const failed: string[] = [];

		for (let i = 0; i < files.length; i++) {
			uploadProgress = files.length > 1
				? `Uploading ${i + 1} of ${files.length}…`
				: 'Uploading…';
			const form = new FormData();
			form.append('image', files[i]);
			try {
				const res = await fetch('/api/upload', { method: 'POST', body: form });
				if (!res.ok) {
					failed.push(files[i].name);
					continue;
				}
				const json = (await res.json()) as { url?: string };
				if (json.url) urls.push(json.url);
				else failed.push(files[i].name);
			} catch {
				failed.push(files[i].name);
			}
		}

		uploading = false;
		uploadProgress = '';

		if (failed.length) {
			error = `Upload failed for ${failed.join(', ')}`;
		}
		if (urls.length) {
			onInsert(urls);
		}
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget && !uploading) onClose();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && !uploading) onClose();
	}

	let pickerLabel = $derived(
		files.length === 0
			? 'Choose files…'
			: files.length === 1
				? files[0].name
				: `${files.length} files selected`
	);
</script>

<svelte:window onkeydown={onKey} />

<div
	class="backdrop"
	role="presentation"
	onclick={onBackdropClick}
	onkeydown={() => {}}
>
	<div class="modal" role="dialog" aria-modal="true" aria-label="Upload image">
		<header>
			<h2>Insert image</h2>
			<button type="button" class="close" onclick={onClose} disabled={uploading} aria-label="Close">
				×
			</button>
		</header>

		<label class="pick">
			<input type="file" accept="image/*" multiple onchange={onPick} disabled={uploading} />
			<span>{pickerLabel}</span>
		</label>

		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<div class="actions">
			<button type="button" class="link" onclick={onClose} disabled={uploading}>Cancel</button>
			<button type="button" onclick={upload} disabled={!files.length || uploading}>
				{uploadProgress || 'Upload & insert'}
			</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: var(--color-scrim);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-section);
		z-index: 50;
	}

	.modal {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		max-width: 420px;
		width: 100%;
		padding: var(--space-section);
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-stack);
	}

	header h2 {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-lede);
		margin: 0;
	}

	.close {
		font: inherit;
		font-size: 20px;
		line-height: 1;
		background: transparent;
		border: 0;
		padding: 0 0.25em;
		cursor: pointer;
		color: var(--color-ink-soft);
	}

	.close:hover:not(:disabled) {
		color: var(--color-ink);
	}

	.pick {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

	.pick input {
		font: inherit;
	}

	.pick span {
		font-style: italic;
	}

	.error {
		color: var(--color-danger);
		font-size: var(--size-meta);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-stack);
	}

	.actions button {
		font: inherit;
		padding: 0.4em 0.6em;
	}

	.actions .link {
		font-style: italic;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: var(--color-ink-soft);
	}

	.actions .link:hover:not(:disabled) {
		color: var(--color-ink);
		text-decoration: underline;
	}
</style>
