<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		src: string;
		alt: string;
		sourceRect: DOMRect;
		naturalWidth: number;
		naturalHeight: number;
		sourceEl: HTMLImageElement;
		onClose: () => void;
	}

	let { src, alt, sourceRect, naturalWidth, naturalHeight, sourceEl, onClose }: Props = $props();

	const TRANSITION_MS = 220;
	const SLIDE_MS = 300;

	let reducedMotion = false;
	if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	let loaded = $state(false);
	let phase = $state<'idle' | 'opening' | 'open' | 'closing'>('idle');
	let imgEl: HTMLImageElement | undefined = $state();

	let currentSrc = $state(untrack(() => src));
	let currentAlt = $state(untrack(() => alt));
	let currentSourceEl = $state(untrack(() => sourceEl));
	let currentNaturalWidth = $state(untrack(() => naturalWidth));
	let currentNaturalHeight = $state(untrack(() => naturalHeight));
	let currentSourceRect = $state(untrack(() => sourceRect));

	let allImages: HTMLImageElement[] = [];
	let currentIndex = $state(-1);
	let hasPrev = $derived(currentIndex > 0);
	let hasNext = $derived(currentIndex >= 0 && currentIndex < allImages.length - 1);

	type Outgoing = { src: string; alt: string; w: number; h: number };
	let outgoing = $state<Outgoing | null>(null);
	let slideDirection = $state<'left' | 'right'>('left');
	let slidePhase = $state<'idle' | 'sliding'>('idle');

	$effect(() => {
		allImages = (Array.from(document.querySelectorAll('.body img')) as HTMLImageElement[])
			.filter((img) => !img.closest('a'));
		currentIndex = allImages.indexOf(sourceEl);
	});

	function navigate(delta: number) {
		const newIndex = currentIndex + delta;
		if (newIndex < 0 || newIndex >= allImages.length) return;
		if (phase !== 'open' || slidePhase !== 'idle') return;

		outgoing = { src: currentSrc, alt: currentAlt, w: target.w, h: target.h };
		slideDirection = delta > 0 ? 'left' : 'right';
		slidePhase = 'sliding';

		const newImg = allImages[newIndex];
		currentSrc = newImg.currentSrc || newImg.src;
		currentAlt = newImg.alt;
		currentSourceRect = newImg.getBoundingClientRect();
		currentNaturalWidth = newImg.naturalWidth;
		currentNaturalHeight = newImg.naturalHeight;
		currentSourceEl = newImg;
		currentIndex = newIndex;

		setTimeout(() => {
			slidePhase = 'idle';
			outgoing = null;
		}, SLIDE_MS);
	}

	function onImgLoad() {
		if (loaded) return;
		loaded = true;
		if (reducedMotion) {
			phase = 'open';
			return;
		}
		phase = 'opening';
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				phase = 'open';
			});
		});
	}

	$effect(() => {
		if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) onImgLoad();
	});

	$effect(() => {
		if (!loaded) return;
		const el = currentSourceEl;
		el.dataset.lightboxSource = 'true';
		return () => {
			delete el.dataset.lightboxSource;
		};
	});

	$effect(() => {
		const html = document.documentElement;
		const prev = html.style.overflow;
		html.style.overflow = 'hidden';
		return () => {
			html.style.overflow = prev;
		};
	});

	let viewport = $state({
		w: typeof window !== 'undefined' ? window.innerWidth : 0,
		h: typeof window !== 'undefined' ? window.innerHeight : 0
	});

	$effect(() => {
		function onResize() {
			viewport = { w: window.innerWidth, h: window.innerHeight };
		}
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	let target = $derived.by(() => {
		const maxW = viewport.w * 0.9;
		const maxH = viewport.h * 0.9;
		const w = currentNaturalWidth || currentSourceRect.width || 1;
		const h = currentNaturalHeight || currentSourceRect.height || 1;
		const aspect = w / h;
		return maxW / aspect <= maxH
			? { w: maxW, h: maxW / aspect }
			: { w: maxH * aspect, h: maxH };
	});

	let imgTransform = $derived.by(() => {
		if (phase === 'open' || !target.w) return 'translate(-50%, -50%)';
		const dx = currentSourceRect.left + currentSourceRect.width / 2 - viewport.w / 2;
		const dy = currentSourceRect.top + currentSourceRect.height / 2 - viewport.h / 2;
		const scale = currentSourceRect.width / target.w;
		return `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
	});

	function dismiss() {
		if (phase === 'closing') return;
		if (phase === 'idle' || reducedMotion) {
			onClose();
			return;
		}
		phase = 'closing';
		setTimeout(onClose, TRANSITION_MS);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') dismiss();
		if (e.key === 'ArrowLeft' && hasPrev) {
			e.preventDefault();
			navigate(-1);
		}
		if (e.key === 'ArrowRight' && hasNext) {
			e.preventDefault();
			navigate(1);
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	class="lightbox"
	class:is-idle={phase === 'idle'}
	class:is-opening={phase === 'opening'}
	class:is-open={phase === 'open'}
	class:is-closing={phase === 'closing'}
	role="dialog"
	tabindex="-1"
	aria-modal="true"
	aria-label={currentAlt || 'Expanded image'}
	onclick={dismiss}
	onkeydown={() => {}}
>
	<div class="backdrop"></div>
	{#if outgoing}
		<img
			class="outgoing"
			class:slide-out-left={slideDirection === 'left'}
			class:slide-out-right={slideDirection === 'right'}
			src={outgoing.src}
			alt=""
			style:width="{outgoing.w}px"
			style:height="{outgoing.h}px"
		/>
	{/if}
	<img
		bind:this={imgEl}
		class:slide-in-from-right={slidePhase === 'sliding' && slideDirection === 'left'}
		class:slide-in-from-left={slidePhase === 'sliding' && slideDirection === 'right'}
		src={currentSrc}
		alt={currentAlt}
		onload={onImgLoad}
		style:width="{target.w}px"
		style:height="{target.h}px"
		style:transform={imgTransform}
	/>
	{#if hasPrev}
		<button
			class="nav nav-prev"
			aria-label="Previous image"
			onclick={(e) => { e.stopPropagation(); navigate(-1); }}
		>&#9664;</button>
	{/if}
	{#if hasNext}
		<button
			class="nav nav-next"
			aria-label="Next image"
			onclick={(e) => { e.stopPropagation(); navigate(1); }}
		>&#9654;</button>
	{/if}
</div>

<style>
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 100;
		cursor: zoom-out;
		overflow: hidden;
		--slide-ms: 300ms;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		background: var(--color-bg);
		opacity: 0;
		transition: opacity 220ms ease-out;
	}

	.lightbox.is-open .backdrop {
		opacity: 1;
	}

	.lightbox img {
		position: fixed;
		top: 50%;
		left: 50%;
		display: block;
		max-width: none;
		cursor: zoom-out;
		transform-origin: 50% 50%;
		transition: transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
		will-change: transform;
    border-radius: 4px;
	}

	.lightbox.is-idle img {
		opacity: 0;
	}

	.outgoing {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: block;
		max-width: none;
		border-radius: 4px;
		pointer-events: none;
	}

	.slide-out-left {
		animation: slide-out-left var(--slide-ms) cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.slide-out-right {
		animation: slide-out-right var(--slide-ms) cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.lightbox img.slide-in-from-right {
		animation: slide-in-from-right var(--slide-ms) cubic-bezier(0.16, 1, 0.3, 1);
	}

	.lightbox img.slide-in-from-left {
		animation: slide-in-from-left var(--slide-ms) cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes slide-out-left {
		from { transform: translate(-50%, -50%); }
		to { transform: translate(calc(-50% - 100vw), -50%); }
	}

	@keyframes slide-out-right {
		from { transform: translate(-50%, -50%); }
		to { transform: translate(calc(-50% + 100vw), -50%); }
	}

	@keyframes slide-in-from-right {
		from { transform: translate(calc(-50% + 100vw), -50%); }
		to { transform: translate(-50%, -50%); }
	}

	@keyframes slide-in-from-left {
		from { transform: translate(calc(-50% - 100vw), -50%); }
		to { transform: translate(-50%, -50%); }
	}

	.nav {
		position: fixed;
		top: 50%;
		transform: translateY(-50%);
		z-index: 101;
		border: none;
		background: var(--color-bg);
		color: var(--color-ink-soft);
		font-size: 1.25rem;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.7;
		transition: opacity 0.15s linear;
	}

	.nav:hover {
		opacity: 1;
	}

	.nav-prev {
		left: 1rem;
	}

	.nav-next {
		right: 1rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.backdrop,
		.lightbox img,
		.nav {
			transition: none;
		}

		.slide-out-left,
		.slide-out-right,
		.lightbox img.slide-in-from-right,
		.lightbox img.slide-in-from-left {
			animation: none;
		}
	}
</style>
