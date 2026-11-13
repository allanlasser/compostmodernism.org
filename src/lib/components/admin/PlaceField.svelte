<script lang="ts">
	import { untrack } from 'svelte';
	import NavigationIcon from '@lucide/svelte/icons/navigation';
	import XIcon from '@lucide/svelte/icons/x';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import {
		distanceKm,
		nominatimReverseUrl,
		placeNameFromNominatim,
		type Coordinates
	} from '$lib/geo';
	import type { PlaceInputParsed } from '$lib/schemas';
	import type { KnownPlace, PlaceLocation } from '$lib/types';

	const NEARBY_KM = 0.5;

	interface Props {
		places?: KnownPlace[];
		initial?: PlaceLocation | null;
		value?: PlaceInputParsed | null;
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

	let name = $state(untrack(() => initial?.name ?? ''));
	let here = $state<Coordinates | null>(
		untrack(() =>
			initial?.latitude != null && initial?.longitude != null
				? { latitude: initial.latitude, longitude: initial.longitude }
				: null
		)
	);
	let locating = $state(false);
	let locateError = $state('');

	function located(p: KnownPlace): p is KnownPlace & Coordinates {
		return p.latitude !== null && p.longitude !== null;
	}

	let byDistance = $derived.by(() => {
		const origin = here;
		if (!origin) return places;
		const km = (p: KnownPlace) => (located(p) ? distanceKm(origin, p) : Infinity);
		return [...places].sort((a, b) => km(a) - km(b));
	});

	$effect(() => {
		const trimmed = name.trim();
		value = trimmed ? { name: trimmed, ...(here ?? {}) } : null;
	});

	async function suggestName(at: Coordinates) {
		try {
			const res = await fetch(nominatimReverseUrl(at), { headers: { Accept: 'application/json' } });
			const suggestion = res.ok ? placeNameFromNominatim(await res.json()) : '';
			if (suggestion && !name) name = suggestion;
		} catch {
			// The name stays blank; typing one by hand is the fallback.
		}
	}

	function locate() {
		if (!navigator.geolocation) {
			locateError = 'This browser can’t share its location.';
			return;
		}
		locating = true;
		locateError = '';
		navigator.geolocation.getCurrentPosition(
			({ coords }) => {
				locating = false;
				const at = { latitude: coords.latitude, longitude: coords.longitude };
				here = at;
				const nearest = places.filter(located).find((p) => distanceKm(at, p) <= NEARBY_KM);
				name = nearest?.name ?? '';
				if (!nearest) suggestName(at);
			},
			(err) => {
				locating = false;
				locateError = err.message || 'Couldn’t get your location.';
			},
			{ enableHighAccuracy: true, timeout: 15000 }
		);
	}
</script>

<div class="place-field" id="place">
	<label for="place-name" class="label">Place</label>
	<div class="row">
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
		<button
			type="button"
			class="button icon"
			onclick={locate}
			disabled={disabled || locating}
			aria-label="Use my location"
			title="Use my location"
		>
			{#if locating}
				<LoaderCircleIcon size={16} class="spin" />
			{:else}
				<NavigationIcon size={16} />
			{/if}
		</button>
	</div>
	<datalist id="place-names">
		{#each byDistance as place (place.slug)}
			<option value={place.name}></option>
		{/each}
	</datalist>

	{#if here}
		<p class="coordinates">
			<span>{here.latitude.toFixed(4)}, {here.longitude.toFixed(4)}</span>
			<button
				type="button"
				class="clear"
				onclick={() => (here = null)}
				{disabled}
				aria-label="Clear location"
				title="Clear location"
			>
				<XIcon size={12} />
			</button>
			<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
				>© OSM</a
			>
		</p>
	{/if}

	{#if locateError}<span class="field-error">{locateError}</span>{/if}
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

	.row {
		display: flex;
		gap: 0.4em;
	}

	input {
		flex: 1 1 auto;
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

	.button.icon {
		flex: 0 0 auto;
		min-width: unset;
		color: var(--color-ink-soft);
		&:hover:not(:disabled) {
			color: var(--color-ink);
		}
	}

	.button.icon :global(.spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.coordinates {
		display: flex;
		align-items: center;
		gap: 0.35em;
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.75em;
	}

	.clear {
		display: inline-flex;
		padding: 0.1em;
		background: transparent;
		border: 0;
		border-radius: 3px;
		color: inherit;
		cursor: pointer;
		&:hover:not(:disabled) {
			color: var(--color-ink);
			background: var(--color-surface-subtle);
		}
	}

	.coordinates a {
		margin-left: auto;
		color: inherit;
		font-family: var(--font-serif);
		font-style: italic;
	}

	.field-error {
		color: var(--color-danger);
	}
</style>
