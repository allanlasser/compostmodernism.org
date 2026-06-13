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

	describe('navigation', () => {
		function addPageImages(count: number): HTMLImageElement[] {
			const wrapper = document.createElement('div');
			wrapper.classList.add('body');
			const imgs: HTMLImageElement[] = [];
			for (let i = 0; i < count; i++) {
				const img = document.createElement('img');
				img.src = `https://images.test/${i}.webp`;
				img.alt = `Image ${i}`;
				Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => 800 });
				Object.defineProperty(img, 'naturalHeight', { configurable: true, get: () => 600 });
				wrapper.appendChild(img);
				imgs.push(img);
			}
			document.body.appendChild(wrapper);
			return imgs;
		}

		afterEach(() => {
			document.querySelectorAll('.body').forEach((el) => el.remove());
		});

		it('shows next button when there are images after the current one', async () => {
			const imgs = addPageImages(3);
			const { container } = render(Lightbox, {
				props: defaults({ sourceEl: imgs[0], src: imgs[0].src })
			});
			await markLoaded(container);
			expect(container.querySelector('.nav-next')).not.toBeNull();
			expect(container.querySelector('.nav-prev')).toBeNull();
		});

		it('shows prev button when there are images before the current one', async () => {
			const imgs = addPageImages(3);
			const { container } = render(Lightbox, {
				props: defaults({ sourceEl: imgs[2], src: imgs[2].src })
			});
			await markLoaded(container);
			expect(container.querySelector('.nav-prev')).not.toBeNull();
		});

		it('shows no nav buttons for a single image', async () => {
			const imgs = addPageImages(1);
			const { container } = render(Lightbox, {
				props: defaults({ sourceEl: imgs[0], src: imgs[0].src })
			});
			await markLoaded(container);
			expect(container.querySelector('.nav-prev')).toBeNull();
			expect(container.querySelector('.nav-next')).toBeNull();
		});

		it('ArrowRight navigates to the next image', async () => {
			const imgs = addPageImages(3);
			const { container } = render(Lightbox, {
				props: defaults({ sourceEl: imgs[0], src: imgs[0].src })
			});
			await markLoaded(container);
			await fireEvent.keyDown(window, { key: 'ArrowRight' });
			const img = container.querySelector('.lightbox img') as HTMLImageElement;
			expect(img.getAttribute('src')).toBe('https://images.test/1.webp');
		});

		it('ArrowLeft navigates to the previous image', async () => {
			const imgs = addPageImages(3);
			const { container } = render(Lightbox, {
				props: defaults({ sourceEl: imgs[1], src: imgs[1].src })
			});
			await markLoaded(container);
			await fireEvent.keyDown(window, { key: 'ArrowLeft' });
			const img = container.querySelector('.lightbox img') as HTMLImageElement;
			expect(img.getAttribute('src')).toBe('https://images.test/0.webp');
		});

		it('clicking next button navigates without dismissing', async () => {
			const onClose = vi.fn();
			const imgs = addPageImages(3);
			const { container } = render(Lightbox, {
				props: defaults({ sourceEl: imgs[0], src: imgs[0].src, onClose })
			});
			await markLoaded(container);
			const nextBtn = container.querySelector('.nav-next') as HTMLButtonElement;
			await fireEvent.click(nextBtn);
			expect(onClose).not.toHaveBeenCalled();
			const img = container.querySelector('.lightbox img') as HTMLImageElement;
			expect(img.getAttribute('src')).toBe('https://images.test/1.webp');
		});

		it('navigation updates the data-lightbox-source attribute', async () => {
			const imgs = addPageImages(3);
			const { container } = render(Lightbox, {
				props: defaults({ sourceEl: imgs[0], src: imgs[0].src })
			});
			await markLoaded(container);
			expect(imgs[0].dataset.lightboxSource).toBe('true');
			await fireEvent.keyDown(window, { key: 'ArrowRight' });
			expect(imgs[0].dataset.lightboxSource).toBeUndefined();
			expect(imgs[1].dataset.lightboxSource).toBe('true');
		});

		it('excludes images inside links from navigation', async () => {
			const wrapper = document.createElement('div');
			wrapper.classList.add('body');
			const sourceImg = document.createElement('img');
			sourceImg.src = 'https://images.test/standalone.webp';
			Object.defineProperty(sourceImg, 'naturalWidth', { configurable: true, get: () => 800 });
			Object.defineProperty(sourceImg, 'naturalHeight', { configurable: true, get: () => 600 });
			wrapper.appendChild(sourceImg);
			const link = document.createElement('a');
			link.href = '#';
			const linkedImg = document.createElement('img');
			linkedImg.src = 'https://images.test/linked.webp';
			link.appendChild(linkedImg);
			wrapper.appendChild(link);
			document.body.appendChild(wrapper);

			const { container } = render(Lightbox, {
				props: defaults({ sourceEl: sourceImg, src: sourceImg.src })
			});
			await markLoaded(container);
			expect(container.querySelector('.nav-next')).toBeNull();
		});
	});
});
