import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('wraps plain text in a paragraph', () => {
		expect(renderMarkdown('just text').trim()).toBe('<p>just text</p>');
	});

	it('renders ![alt](url) as <img>', () => {
		const html = renderMarkdown('![A loaf](https://images.test/x.webp)');
		expect(html).toContain('<img');
		expect(html).toMatch(/src="https:\/\/images\.test\/x\.webp"/);
		expect(html).toMatch(/alt="A loaf"/);
	});

	it('renders **bold** as <strong>', () => {
		expect(renderMarkdown('this is **bold**')).toContain('<strong>bold</strong>');
	});

	it('renders inline links as <a>', () => {
		const html = renderMarkdown('see [docs](https://svelte.dev)');
		expect(html).toMatch(/<a href="https:\/\/svelte\.dev">docs<\/a>/);
	});

	it('preserves multiple paragraphs across blank lines', () => {
		const html = renderMarkdown('first paragraph\n\nsecond paragraph');
		expect(html).toMatch(/<p>first paragraph<\/p>/);
		expect(html).toMatch(/<p>second paragraph<\/p>/);
	});

	it('keeps body + image markdown together (the bread-post case)', () => {
		const body =
			'Made bread again. The starter is two years old now.\n\n![Loaf](https://images.compostmodernism.org/images/2026/05/16/abc.webp)';
		const html = renderMarkdown(body);
		expect(html).toMatch(/<p>Made bread again/);
		expect(html).toContain('<img');
		expect(html).toMatch(/src="https:\/\/images\.compostmodernism\.org\/images\/2026\/05\/16\/abc\.webp"/);
	});

	it('returns empty string for empty input (no spurious <p></p>)', () => {
		expect(renderMarkdown('').trim()).toBe('');
	});
});
