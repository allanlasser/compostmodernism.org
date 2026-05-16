<script lang="ts">
	import { untrack } from 'svelte';

	interface AdminPost {
		slug: string;
		body: string;
		title: string | null;
		url: string | null;
		date: number;
		tags: { name: string; slug: string }[];
		permalink: string;
	}

	interface Props {
		data: { posts?: AdminPost[] };
	}

	let { data }: Props = $props();

	// ── Login ──────────────────────────────────────────────────────────────
	let password = $state('');
	let loginError = $state('');

	async function login() {
		const res = await fetch('/api/session', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password })
		});
		if (res.ok) window.location.reload();
		else loginError = 'Incorrect password';
	}

	// ── Image uploader ─────────────────────────────────────────────────────
	let imageFile = $state<File | null>(null);
	let uploading = $state(false);
	let imageUrl = $state('');
	let urlInput: HTMLInputElement | undefined = $state();

	function onPickImage(e: Event) {
		const input = e.target as HTMLInputElement;
		imageFile = input.files?.[0] ?? null;
	}

	async function uploadImage() {
		if (!imageFile) return;
		uploading = true;
		const form = new FormData();
		form.append('image', imageFile);
		const res = await fetch('/api/upload', { method: 'POST', body: form });
		const json = (await res.json()) as { url?: string };
		uploading = false;
		if (res.ok && json.url) {
			imageUrl = json.url;
			setTimeout(() => urlInput?.select(), 50);
		}
	}

	// ── Post editing ───────────────────────────────────────────────────────
	interface Draft {
		body: string;
		title: string;
		url: string;
		tags: string;
	}

	function makeDraft(post: AdminPost): Draft {
		return {
			body: post.body,
			title: post.title ?? '',
			url: post.url ?? '',
			tags: post.tags.map((t) => t.name).join(', ')
		};
	}

	// Drafts are seeded from data.posts on mount, then updated only by user typing.
	// We intentionally capture the initial value: we never want a future data refresh
	// to clobber edits in flight.
	let drafts = $state<Record<string, Draft>>(
		untrack(() => Object.fromEntries((data.posts ?? []).map((p) => [p.slug, makeDraft(p)])))
	);

	// If new posts appear in data.posts (e.g. future compose flow), seed drafts for them
	// without overwriting any user edits already in flight.
	$effect(() => {
		for (const post of data.posts ?? []) {
			if (!drafts[post.slug]) drafts[post.slug] = makeDraft(post);
		}
	});

	let saving = $state<Record<string, boolean>>({});
	let saved = $state<Record<string, boolean>>({});

	// Last-saved snapshot per slug — drives the <summary> preview. Updated only
	// when the server confirms the PATCH so unsaved edits don't leak into the header.
	interface Committed {
		title: string | null;
		body: string;
	}
	let committed = $state<Record<string, Committed>>({});

	function summaryText(post: AdminPost): string {
		const c = committed[post.slug];
		const title = c ? c.title : post.title;
		const body = c ? c.body : post.body;
		return title ?? body.slice(0, 60);
	}

	async function save(post: AdminPost) {
		const d = drafts[post.slug];
		const tags = d.tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		const body = d.body.trim();
		const title = d.title.trim() || null;
		const url = d.url.trim() || null;

		saving[post.slug] = true;
		const res = await fetch(`/api/post/${post.slug}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ body, title, url, tags })
		});
		saving[post.slug] = false;
		if (res.ok) {
			committed[post.slug] = { title, body };
			saved[post.slug] = true;
			setTimeout(() => {
				saved[post.slug] = false;
			}, 2000);
		}
	}

	function buttonLabel(slug: string): string {
		if (saving[slug]) return 'Saving…';
		if (saved[slug]) return 'Saved ✓';
		return 'Save';
	}
</script>

{#if !data.posts}
	<main class="admin admin--login">
		<h1>Admin</h1>
		<input
			type="password"
			placeholder="Password"
			bind:value={password}
			onkeydown={(e) => e.key === 'Enter' && login()}
		/>
		<button onclick={login}>Sign in</button>
		{#if loginError}<p class="error">{loginError}</p>{/if}
	</main>
{:else}
	<main class="admin admin--authenticated">
		<h1>Admin</h1>

		<section class="admin-upload">
			<h2>Upload Image</h2>
			<input type="file" accept="image/*" onchange={onPickImage} />
			<button onclick={uploadImage} disabled={!imageFile || uploading}>
				{uploading ? 'Uploading…' : 'Upload'}
			</button>
			{#if imageUrl}
				<label>
					Image URL — copy and paste into your post as <code>![caption](url)</code>
					<input
						type="text"
						readonly
						value={imageUrl}
						bind:this={urlInput}
						onfocus={(e) => (e.target as HTMLInputElement).select()}
					/>
				</label>
			{/if}
		</section>

		<section class="admin-posts">
			<h2>Posts</h2>

			{#each data.posts as post (post.slug)}
				<details class="admin-post">
					<summary>
						<span class="admin-post__preview">{summaryText(post)}</span>
						<time datetime={new Date(post.date).toISOString()}>
							{new Date(post.date).toLocaleDateString()}
						</time>
					</summary>

					<div class="admin-post__fields">
						<label>
							Title
							<input type="text" id="title-{post.slug}" bind:value={drafts[post.slug].title} />
						</label>
						<label>
							URL
							<input type="url" id="url-{post.slug}" bind:value={drafts[post.slug].url} />
						</label>
						<label>
							Tags <span class="hint">(comma-separated)</span>
							<input
								type="text"
								id="tags-{post.slug}"
								bind:value={drafts[post.slug].tags}
								placeholder="food, travel, tech"
							/>
						</label>
						<label>
							Body
							<textarea id="body-{post.slug}" rows="5" bind:value={drafts[post.slug].body}
							></textarea>
						</label>

						<div class="admin-post__actions">
							<a href={post.permalink} target="_blank" rel="noopener noreferrer">View ➻</a>
							<button class="save" onclick={() => save(post)} disabled={saving[post.slug]}>
								{buttonLabel(post.slug)}
							</button>
						</div>
					</div>
				</details>
			{/each}
		</section>
	</main>
{/if}

<style>
	.admin {
		display: flex;
		flex-direction: column;
		gap: var(--space-section);
		width: 100%;
	}

	.admin h1 {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-title);
	}

	.admin h2 {
		font-size: var(--size-lede);
		font-style: italic;
	}

	.admin--login {
		max-width: 320px;
		gap: var(--space-stack);
	}

	.admin--login input,
	.admin--login button {
		font: inherit;
		padding: 0.5em 0.75em;
	}

	.error {
		color: #a13c1f;
		font-size: var(--size-meta);
	}

	.admin-upload,
	.admin-posts {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
	}

	.admin-upload label {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

	.admin-upload input[type='text'] {
		font: inherit;
		padding: 0.4em 0.6em;
	}

	.admin-post {
		border-top: 1px solid rgb(79 36 19 / 0.15);
		padding: var(--space-stack) 0;
	}

	.admin-post summary {
		display: flex;
		justify-content: space-between;
		gap: var(--space-stack);
		cursor: pointer;
		list-style: none;
	}

	.admin-post summary::-webkit-details-marker {
		display: none;
	}

	.admin-post__preview {
		font-weight: 500;
	}

	.admin-post summary time {
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
		white-space: nowrap;
	}

	.admin-post__fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
		padding-top: var(--space-stack);
	}

	.admin-post__fields label {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

	.admin-post__fields input,
	.admin-post__fields textarea {
		font: inherit;
		padding: 0.4em 0.6em;
	}

	.admin-post__fields textarea {
		font-family: var(--font-serif);
		line-height: var(--leading-body);
		resize: vertical;
	}

	.hint {
		font-style: italic;
	}

	.admin-post__actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.admin-post__actions a {
		text-decoration: none;
	}

	.admin-post__actions a:hover {
		text-decoration: underline;
	}
</style>
