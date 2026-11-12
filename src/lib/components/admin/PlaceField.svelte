<script lang="ts">
	import { untrack } from 'svelte';
	import {
		distanceKm,
		nominatimReverseUrl,
		placeNameFromNominatim,
		type Coordinates
	} from '$lib/geo';
	import type { PlaceInputParsed } from '$lib/schemas';
	import type { AdminPlace } from '$lib/types';

	const NEARBY_KM = 0.5;

	interface Props {
		places?: AdminPlace[];
		initialSlug?: string | null;
		value?: PlaceInputParsed | null;
		disabled?: boolean;
		error?: string;
	}

	let {
		places = [],
		initialSlug = null,
		value = $bindable(null),
		disabled = false,
		error
	}: Props = $props();

	const initialId = untrack(() => places.find((p) => p.slug === initialSlug)?.id);
	let choice = $state(initialId ? String(initialId) : '');
	let newName = $state('');
	let here = $state<Coordinates | null>(null);
	let locating = $state(false);
	let locateError = $state('');
	let suggested = false;

	let options = $derived.by(() => {
		const origin = here;
		if (!origin) return places.map((p) => ({ place: p, label: p.name }));
		return places
			.map((p) => ({ place: p, km: distanceKm(origin, p) }))
			.sort((a, b) => a.km - b.km)
			.map(({ place, km }) => ({ place, label: `${place.name} · ${km.toFixed(1)} km` }));
	});

	$effect(() => {
		if (choice === 'new' && here) value = { name: newName.trim(), ...here };
		else if (choice) value = { id: Number(choice) };
		else value = null;
	});

	async function suggestName(at: Coordinates) {
		if (suggested) return;
		suggested = true;
		try {
			const res = await fetch(nominatimReverseUrl(at), { headers: { Accept: 'application/json' } });
			const name = res.ok ? placeNameFromNominatim(await res.json()) : '';
			if (name && !newName) newName = name;
		} catch {
			// The name stays blank; typing one by hand is the fallback.
		}
	}

	function onChoice(e?: Event) {
		if (e) choice = (e.currentTarget as HTMLSelectElement).value;
		if (choice === 'new' && here) suggestName(here);
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
				here = { latitude: coords.latitude, longitude: coords.longitude };
				const nearest = options[0];
				if (nearest && distanceKm(here, nearest.place) <= NEARBY_KM) {
					choice = String(nearest.place.id);
				} else {
					choice = 'new';
				}
				onChoice();
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
	<label>
		<span class="label">Place</span>
		<select value={choice} onchange={onChoice} {disabled}>
			<option value="">None</option>
			{#each options as { place, label } (place.id)}
				<option value={String(place.id)}>{label}</option>
			{/each}
			{#if here}
				<option value="new">New place here…</option>
			{/if}
		</select>
	</label>

	{#if choice === 'new' && here}
		<label>
			<span class="label visually-hidden">New place name</span>
			<input
				type="text"
				name="place-name"
				bind:value={newName}
				placeholder="Place name"
				{disabled}
			/>
			<span class="hint">
				{here.latitude.toFixed(4)}, {here.longitude.toFixed(4)} · names suggested by
				<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
					>OpenStreetMap</a
				>
			</span>
		</label>
	{/if}

	<button type="button" class="link" onclick={locate} disabled={disabled || locating}>
		{locating ? 'Locating…' : 'Use my location'}
	</button>

	{#if locateError}<span class="field-error">{locateError}</span>{/if}
	{#if error}<span class="field-error">{error}</span>{/if}
</div>

<style>
	.place-field {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.4em;
	}

	select {
		font: inherit;
		padding: 0.4em 0.6em;
		background: var(--color-field);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		color: inherit;
	}

	.link {
		align-self: flex-start;
		font: inherit;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: var(--color-ink-soft);
		font-size: var(--size-meta);
	}

	.link:hover:not(:disabled) {
		color: var(--color-ink);
		text-decoration: underline;
	}

	.hint {
		font-style: italic;
	}

	.hint a {
		color: inherit;
	}
</style>
