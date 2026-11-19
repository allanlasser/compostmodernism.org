<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		places?: string[];
		initial?: string | null;
		value?: string | null;
		disabled?: boolean;
		error?: string;
	}

	let {
		places = [],
		initial = null,
		value = $bindable(null),
		disabled = false,
		error
	}: Props = $props();

	let name = $state(untrack(() => initial ?? ''));

	$effect(() => {
		value = name.trim() || null;
	});
</script>

<div class="place-field" id="place">
	<label for="place-name" class="label">Place</label>
	<input
		id="place-name"
		type="text"
		name="place"
		list="place-names"
		autocomplete="off"
		bind:value={name}
		placeholder="Where are you?"
		{disabled}
	/>
	<datalist id="place-names">
		{#each places as place (place)}
			<option value={place}></option>
		{/each}
	</datalist>

	{#if error}<span class="field-error">{error}</span>{/if}
</div>

<style>
	.place-field {
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}

	input {
		font: inherit;
		min-width: 0;
		padding: 0.4em 0.6em;
		background: var(--color-field);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		color: var(--color-ink);
		&:focus,
		&:hover {
			background: var(--color-field-focus);
		}
	}

	.field-error {
		color: var(--color-danger);
	}
</style>
