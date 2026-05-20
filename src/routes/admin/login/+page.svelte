<script lang="ts">
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function signIn() {
		if (!password || busy) return;
		busy = true;
		error = '';
		const res = await fetch('/api/session', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password })
		});
		busy = false;
		if (res.ok) {
			window.location.href = '/admin';
		} else {
			error = 'Incorrect password';
			password = '';
		}
	}
</script>

<main class="admin-login">
	<h1>Admin</h1>
	<label>
		Password
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="password"
			bind:value={password}
			onkeydown={(e) => e.key === 'Enter' && signIn()}
			disabled={busy}
			autofocus
		/>
	</label>
	<button type="button" onclick={signIn} disabled={!password || busy}>
		{busy ? 'Signing in…' : 'Sign in'}
	</button>
	{#if error}<p class="error">{error}</p>{/if}
</main>

<style>
	.admin-login {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
		max-width: 320px;
	}

	.admin-login h1 {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--size-title);
	}

	.admin-login label {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

	.admin-login input,
	.admin-login button {
		font: inherit;
		padding: 0.5em 0.75em;
	}

	.error {
		color: var(--color-danger);
		font-size: var(--size-meta);
	}
</style>
