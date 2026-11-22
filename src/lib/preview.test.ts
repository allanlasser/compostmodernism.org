import { describe, it, expect } from 'vitest';
import { postPreview } from './preview';

describe('postPreview', () => {
	it('returns the leading image and the text after it', () => {
		const p = postPreview('![A spider](https://static.example/spider.jpg)\n\nFound this one in the garden.');
		expect(p.image).toEqual({ src: 'https://static.example/spider.jpg', alt: 'A spider' });
		expect(p.text).toBe('Found this one in the garden.');
	});

	it('returns no image when the post does not start with one', () => {
		const p = postPreview('Some words first.\n\n![](https://static.example/a.jpg)');
		expect(p.image).toBeNull();
		expect(p.text).toBe('Some words first.');
	});

	it('renders markdown links as their text', () => {
		const p = postPreview('[Katie Mack](https://bsky.app/profile/x) said a thing');
		expect(p.text).toBe('Katie Mack said a thing');
	});

	it('truncates long text on a word boundary with an ellipsis', () => {
		const p = postPreview('word '.repeat(50));
		expect(p.text.length).toBeLessThanOrEqual(81);
		expect(p.text.endsWith('word…')).toBe(true);
	});
});
