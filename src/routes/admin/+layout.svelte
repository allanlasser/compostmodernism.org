<script lang="ts">
	import type { Snippet } from 'svelte';
	import AdminNav from '$lib/components/admin/AdminNav.svelte';

	interface Props {
		children: Snippet;
		data: { authed: boolean };
	}

	let { children, data }: Props = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="admin-shell">
	{#if data.authed}
		<AdminNav />
	{/if}
	{@render children()}
</div>

<style>
	.admin-shell {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
		width: 100%;
	}
</style>
