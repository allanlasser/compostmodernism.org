<script lang="ts">
	import CadenceGraph from '$lib/components/admin/CadenceGraph.svelte';

	interface Props {
		data: { cadence: { date: string; count: number }[] };
	}

	let { data }: Props = $props();
</script>

<section class="dashboard">
	<h2 class="section-label">Posting cadence</h2>
	<CadenceGraph cadence={data.cadence} />
</section>

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
	}

	.section-label {
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}
</style>
