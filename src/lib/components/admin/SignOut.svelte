<script lang="ts">
	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		await fetch('/api/session', { method: 'DELETE' });
		window.location.href = '/';
	}
</script>

<button type="button" onclick={signOut} disabled={signingOut}>
  {signingOut ? 'Signing out…' : 'Sign out'}
</button>

<style>
  	button {
		font: inherit;
		font-style: italic;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: var(--color-ink-soft);
	}

	button:hover:not(:disabled) {
		color: var(--color-ink);
		text-decoration: underline;
	}
</style>