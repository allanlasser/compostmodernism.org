<script lang="ts">
	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		await fetch('/api/session', { method: 'DELETE' });
		window.location.href = '/admin/login';
	}
</script>

<nav class="admin-nav">
	<ul>
		<li><a href="/admin/posts">Posts</a></li>
		<li><a href="/admin/images">Images</a></li>
	</ul>
	<button type="button" onclick={signOut} disabled={signingOut}>
		{signingOut ? 'Signing out…' : 'Sign out'}
	</button>
</nav>

<style>
	.admin-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-stack);
		padding-bottom: var(--space-stack);
		border-bottom: 1px solid rgb(79 36 19 / 0.15);
	}

	.admin-nav ul {
		display: flex;
		gap: var(--space-gap);
	}

	.admin-nav a {
		text-decoration: none;
		font-style: italic;
	}

	.admin-nav a:hover {
		text-decoration: underline;
	}

	.admin-nav button {
		font: inherit;
		font-style: italic;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: var(--color-ink-soft);
	}

	.admin-nav button:hover:not(:disabled) {
		color: var(--color-ink);
		text-decoration: underline;
	}
</style>
