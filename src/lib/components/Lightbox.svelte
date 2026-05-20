<script lang="ts">
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

	let reducedMotion = false;
	if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	let loaded = $state(false);
	let phase = $state<'idle' | 'opening' | 'open' | 'closing'>('idle');
	let imgEl: HTMLImageElement | undefined = $state();

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
		sourceEl.dataset.lightboxSource = 'true';
		return () => {
			delete sourceEl.dataset.lightboxSource;
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
		const w = naturalWidth || sourceRect.width || 1;
		const h = naturalHeight || sourceRect.height || 1;
		const aspect = w / h;
		return maxW / aspect <= maxH
			? { w: maxW, h: maxW / aspect }
			: { w: maxH * aspect, h: maxH };
	});

	let imgTransform = $derived.by(() => {
		if (phase === 'open' || !target.w) return 'translate(-50%, -50%)';
		const dx = sourceRect.left + sourceRect.width / 2 - viewport.w / 2;
		const dy = sourceRect.top + sourceRect.height / 2 - viewport.h / 2;
		const scale = sourceRect.width / target.w;
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
	aria-label={alt || 'Expanded image'}
	onclick={dismiss}
	onkeydown={() => {}}
>
	<div class="backdrop"></div>
	<img
		bind:this={imgEl}
		{src}
		{alt}
		onload={onImgLoad}
		style:width="{target.w}px"
		style:height="{target.h}px"
		style:transform={imgTransform}
	/>
</div>

<style>
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 100;
		cursor: zoom-out;
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

	@media (prefers-reduced-motion: reduce) {
		.backdrop,
		.lightbox img {
			transition: none;
		}
	}
</style>
