import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import Lightbox from './Lightbox.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function defaults(over: Partial<Parameters<typeof render>[1]['props']> = {}) {
	return {
		src: 'https://images.test/x.webp',
		alt: 'A loaf',
		sourceRect: new DOMRect(10, 20, 200, 100),
		naturalWidth: 1600,
		naturalHeight: 800,
		sourceEl: document.createElement('img'),
		onClose: vi.fn(),
		...over
	};
}

async function markLoaded(container: HTMLElement) {
	const img = container.querySelector('.lightbox img') as HTMLImageElement;
	Object.defineProperty(img, 'complete', { configurable: true, get: () => true });
	Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => 1600 });
	await fireEvent.load(img);
}

describe('Lightbox', () => {
	it('renders an <img> with the given src and alt', () => {
		const { container } = render(Lightbox, { props: defaults() });
		const img = container.querySelector('.lightbox img') as HTMLImageElement;
		expect(img).not.toBeNull();
		expect(img.getAttribute('src')).toBe('https://images.test/x.webp');
		expect(img.getAttribute('alt')).toBe('A loaf');
	});

	it('clicking the image calls onClose after the close transition', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onClose = vi.fn();
			const { container } = render(Lightbox, { props: defaults({ onClose }) });
			await markLoaded(container);
			const img = container.querySelector('.lightbox img') as HTMLImageElement;
			await fireEvent.click(img);
			expect(onClose).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(300);
			expect(onClose).toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it('clicking the backdrop calls onClose after the close transition', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onClose = vi.fn();
			const { container } = render(Lightbox, { props: defaults({ onClose }) });
			await markLoaded(container);
			const backdrop = container.querySelector('.lightbox .backdrop') as HTMLDivElement;
			expect(backdrop).not.toBeNull();
			await fireEvent.click(backdrop);
			await vi.advanceTimersByTimeAsync(300);
			expect(onClose).toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it('Escape keydown calls onClose after the close transition', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			const onClose = vi.fn();
			const { container } = render(Lightbox, { props: defaults({ onClose }) });
			await markLoaded(container);
			await fireEvent.keyDown(window, { key: 'Escape' });
			await vi.advanceTimersByTimeAsync(300);
			expect(onClose).toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it('click sets is-closing class immediately', async () => {
		const { container } = render(Lightbox, { props: defaults() });
		await markLoaded(container);
		const dialog = container.querySelector('.lightbox') as HTMLDivElement;
		await fireEvent.click(dialog);
		expect(dialog.classList.contains('is-closing')).toBe(true);
		expect(dialog.classList.contains('is-open')).toBe(false);
	});

	it('has role="dialog" and aria-modal="true"', () => {
		const { container } = render(Lightbox, { props: defaults() });
		const dialog = container.querySelector('.lightbox');
		expect(dialog?.getAttribute('role')).toBe('dialog');
		expect(dialog?.getAttribute('aria-modal')).toBe('true');
	});

	it('uses alt as aria-label when provided', () => {
		const { container } = render(Lightbox, { props: defaults({ alt: 'A specific loaf' }) });
		const dialog = container.querySelector('.lightbox');
		expect(dialog?.getAttribute('aria-label')).toBe('A specific loaf');
	});

	it('prefers-reduced-motion: reduce → goes to "open" phase without opening animation', async () => {
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: query.includes('reduce'),
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false,
			onchange: null
		}));
		const { container } = render(Lightbox, { props: defaults() });
		await markLoaded(container);
		const dialog = container.querySelector('.lightbox');
		expect(dialog?.classList.contains('is-open')).toBe(true);
		expect(dialog?.classList.contains('is-opening')).toBe(false);
	});

	it('idle phase: lightbox img stays invisible until load fires', async () => {
		const { container } = render(Lightbox, { props: defaults() });
		const dialog = container.querySelector('.lightbox') as HTMLDivElement;
		expect(dialog.classList.contains('is-idle')).toBe(true);
		await markLoaded(container);
		expect(dialog.classList.contains('is-idle')).toBe(false);
	});

	it('idle phase: source-hide marker is not applied until load fires', async () => {
		const sourceEl = document.createElement('img');
		const { container } = render(Lightbox, { props: defaults({ sourceEl }) });
		expect(sourceEl.dataset.lightboxSource).toBeUndefined();
		await markLoaded(container);
		expect(sourceEl.dataset.lightboxSource).toBe('true');
	});
});
