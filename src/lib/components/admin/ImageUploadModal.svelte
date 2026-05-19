<script lang="ts">
	interface Props {
		onInsert: (url: string) => void;
		onClose: () => void;
	}

	let { onInsert, onClose }: Props = $props();

	let file = $state<File | null>(null);
	let uploading = $state(false);
	let error = $state('');

	function onPick(e: Event) {
		const input = e.target as HTMLInputElement;
		file = input.files?.[0] ?? null;
		error = '';
	}

	async function upload() {
		if (!file || uploading) return;
		uploading = true;
		error = '';
		const form = new FormData();
		form.append('image', file);
		const res = await fetch('/api/upload', { method: 'POST', body: form });
		uploading = false;
		if (!res.ok) {
			error = 'Upload failed.';
			return;
		}
		const json = (await res.json()) as { url?: string };
		if (json.url) onInsert(json.url);
		else error = 'Server did not return a URL.';
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget && !uploading) onClose();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && !uploading) onClose();
	}
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
			<input type="file" accept="image/*" onchange={onPick} disabled={uploading} />
			<span>{file ? file.name : 'Choose a file…'}</span>
		</label>

		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<div class="actions">
			<button type="button" class="link" onclick={onClose} disabled={uploading}>Cancel</button>
			<button type="button" onclick={upload} disabled={!file || uploading}>
				{uploading ? 'Uploading…' : 'Upload & insert'}
			</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgb(79 36 19 / 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-section);
		z-index: 50;
	}

	.modal {
		background: var(--color-bg);
		border: 1px solid rgb(79 36 19 / 0.2);
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
		color: #a13c1f;
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
