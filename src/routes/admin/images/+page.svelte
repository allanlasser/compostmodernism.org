<script lang="ts">
	import ImagesTable from '$lib/components/admin/ImagesTable.svelte';
  import type { Image } from '$lib/types';

	interface Props {
		data: {
			images: Image[];
			page: number;
			perPage: number;
			total: number;
			totalPages: number;
		};
	}

	let { data }: Props = $props();

	let uploading = $state(false);
	let uploadError = $state('');

	async function uploadNew(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		uploading = true;
		uploadError = '';
		const form = new FormData();
		form.append('image', file);
		const res = await fetch('/api/upload', { method: 'POST', body: form });
		uploading = false;
		if (res.ok) {
			window.location.reload();
		} else {
			uploadError = 'Upload failed.';
		}
	}
</script>

<header class="images-header">
	<p class="status">{data.total} {data.total === 1 ? 'image' : 'images'}</p>
	<label class="upload">
		<input type="file" accept="image/*" onchange={uploadNew} disabled={uploading} />
		<span>{uploading ? 'Uploading…' : '+ Upload image'}</span>
	</label>
</header>
{#if uploadError}<p class="error">{uploadError}</p>{/if}

<ImagesTable images={data.images} />

{#if data.totalPages > 1}
	<nav class="pager" aria-label="Pagination">
		{#if data.page > 1}
			<a href="?page={data.page - 1}" rel="prev">← Prev</a>
		{:else}
			<span class="muted">← Prev</span>
		{/if}
		<span class="status">Page {data.page} of {data.totalPages} · {data.total} images</span>
		{#if data.page < data.totalPages}
			<a href="?page={data.page + 1}" rel="next">Next →</a>
		{:else}
			<span class="muted">Next →</span>
		{/if}
	</nav>
{/if}

<style>
	.images-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-stack);
	}

	.upload {
		font-style: italic;
		cursor: pointer;
	}

	.upload input {
		display: none;
	}

	.upload span:hover {
		text-decoration: underline;
	}

	.error {
		color: var(--color-danger);
		font-size: var(--size-meta);
	}

	.pager {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-stack);
		padding-top: var(--space-stack);
		font-size: var(--size-meta);
	}

	.pager a {
		text-decoration: none;
		font-style: italic;
	}

	.pager a:hover {
		text-decoration: underline;
	}

	.status,
	.pager .status {
		color: var(--color-ink-soft);
		font-size: var(--size-meta);
	}

	.muted {
		color: var(--color-ink-dim);
		font-size: var(--size-meta);
	}
</style>
