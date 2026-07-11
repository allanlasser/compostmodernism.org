import { describe, it, expect } from 'vitest';
import { portableTextToMarkdown } from './portable-text';
import type { SanityBlock, SanityImageBlock } from './portable-text';

const noopImage = async (_block: SanityImageBlock) => 'https://example.com/img.webp';

function textBlock(
	text: string,
	opts: { style?: string; marks?: string[]; markDefs?: { _key: string; _type: string; href?: string }[] } = {}
): SanityBlock {
	return {
		_type: 'block',
		style: opts.style ?? 'normal',
		markDefs: opts.markDefs ?? [],
		children: [{ _type: 'span', text, marks: opts.marks ?? [] }]
	};
}

describe('portableTextToMarkdown', () => {
	describe('paragraph and inline marks', () => {
		it('renders a plain paragraph', async () => {
			const md = await portableTextToMarkdown([textBlock('Hello world')], noopImage);
			expect(md).toBe('Hello world');
		});

		it('renders bold', async () => {
			const md = await portableTextToMarkdown([textBlock('bold', { marks: ['strong'] })], noopImage);
			expect(md).toBe('**bold**');
		});

		it('renders italic', async () => {
			const md = await portableTextToMarkdown([textBlock('italic', { marks: ['em'] })], noopImage);
			expect(md).toBe('_italic_');
		});

		it('renders inline code', async () => {
			const md = await portableTextToMarkdown([textBlock('fn()', { marks: ['code'] })], noopImage);
			expect(md).toBe('`fn()`');
		});

		it('renders a link annotation', async () => {
			const md = await portableTextToMarkdown(
				[
					textBlock('click here', {
						marks: ['lnk1'],
						markDefs: [{ _key: 'lnk1', _type: 'link', href: 'https://example.com' }]
					})
				],
				noopImage
			);
			expect(md).toBe('[click here](https://example.com)');
		});

		it('renders bold inside a link', async () => {
			const block: SanityBlock = {
				_type: 'block',
				style: 'normal',
				markDefs: [{ _key: 'lnk1', _type: 'link', href: 'https://example.com' }],
				children: [{ _type: 'span', text: 'bold link', marks: ['strong', 'lnk1'] }]
			};
			const md = await portableTextToMarkdown([block], noopImage);
			expect(md).toBe('[**bold link**](https://example.com)');
		});

		it('joins multiple spans in one block', async () => {
			const block: SanityBlock = {
				_type: 'block',
				style: 'normal',
				markDefs: [],
				children: [
					{ _type: 'span', text: 'Hello ', marks: [] },
					{ _type: 'span', text: 'world', marks: ['strong'] }
				]
			};
			const md = await portableTextToMarkdown([block], noopImage);
			expect(md).toBe('Hello **world**');
		});

		it('separates paragraphs with a blank line', async () => {
			const md = await portableTextToMarkdown([textBlock('First'), textBlock('Second')], noopImage);
			expect(md).toBe('First\n\nSecond');
		});
	});

	describe('headings', () => {
		it.each([
			['h1', '# '],
			['h2', '## '],
			['h3', '### '],
			['h4', '#### ']
		])('renders %s', async (style, prefix) => {
			const md = await portableTextToMarkdown([textBlock('Title', { style })], noopImage);
			expect(md).toBe(`${prefix}Title`);
		});
	});

	describe('blockquote', () => {
		it('renders blockquote style', async () => {
			const md = await portableTextToMarkdown([textBlock('A quote', { style: 'blockquote' })], noopImage);
			expect(md).toBe('> A quote');
		});
	});

	describe('lists', () => {
		it('renders bullet list', async () => {
			const blocks: SanityBlock[] = [
				{ _type: 'block', style: 'normal', listItem: 'bullet', level: 1, markDefs: [], children: [{ _type: 'span', text: 'First', marks: [] }] },
				{ _type: 'block', style: 'normal', listItem: 'bullet', level: 1, markDefs: [], children: [{ _type: 'span', text: 'Second', marks: [] }] }
			];
			const md = await portableTextToMarkdown(blocks, noopImage);
			expect(md).toBe('- First\n- Second');
		});

		it('renders numbered list', async () => {
			const blocks: SanityBlock[] = [
				{ _type: 'block', style: 'normal', listItem: 'number', level: 1, markDefs: [], children: [{ _type: 'span', text: 'Alpha', marks: [] }] },
				{ _type: 'block', style: 'normal', listItem: 'number', level: 1, markDefs: [], children: [{ _type: 'span', text: 'Beta', marks: [] }] }
			];
			const md = await portableTextToMarkdown(blocks, noopImage);
			expect(md).toBe('1. Alpha\n1. Beta');
		});

		it('indents nested list items', async () => {
			const blocks: SanityBlock[] = [
				{ _type: 'block', style: 'normal', listItem: 'bullet', level: 1, markDefs: [], children: [{ _type: 'span', text: 'Top', marks: [] }] },
				{ _type: 'block', style: 'normal', listItem: 'bullet', level: 2, markDefs: [], children: [{ _type: 'span', text: 'Nested', marks: [] }] }
			];
			const md = await portableTextToMarkdown(blocks, noopImage);
			expect(md).toBe('- Top\n  - Nested');
		});
	});

	describe('code blocks', () => {
		it('renders fenced code block with language', async () => {
			const block: SanityBlock = {
				_type: 'code',
				language: 'typescript',
				code: 'const x = 1;'
			};
			const md = await portableTextToMarkdown([block], noopImage);
			expect(md).toBe('```typescript\nconst x = 1;\n```');
		});

		it('includes filename as annotation when present', async () => {
			const block: SanityBlock = {
				_type: 'code',
				language: 'javascript',
				filename: 'app.js',
				code: 'console.log(42)'
			};
			const md = await portableTextToMarkdown([block], noopImage);
			expect(md).toBe('```javascript app.js\nconsole.log(42)\n```');
		});

		it('renders code block with no language', async () => {
			const block: SanityBlock = { _type: 'code', code: 'plain text' };
			const md = await portableTextToMarkdown([block], noopImage);
			expect(md).toBe('```\nplain text\n```');
		});
	});

	describe('image blocks', () => {
		it('calls imageHandler and wraps in markdown image syntax', async () => {
			const handler = async (_b: SanityImageBlock) => 'https://r2.example.com/img.webp';
			const block: SanityBlock = { _type: 'image', alt: 'A photo', assetId: 'img-123' };
			const md = await portableTextToMarkdown([block], handler);
			expect(md).toBe('![A photo](https://r2.example.com/img.webp)');
		});

		it('appends caption as italic line when present', async () => {
			const block: SanityBlock = {
				_type: 'image',
				alt: 'Sunset',
				caption: 'Golden hour',
				assetId: 'img-456'
			};
			const md = await portableTextToMarkdown([block], noopImage);
			expect(md).toBe('![Sunset](https://example.com/img.webp)\n_Golden hour_');
		});

		it('uses empty string for missing alt', async () => {
			const block: SanityBlock = { _type: 'image', assetId: 'img-789' };
			const md = await portableTextToMarkdown([block], noopImage);
			expect(md).toBe('![](https://example.com/img.webp)');
		});
	});

	describe('break blocks', () => {
		it('renders break as horizontal rule', async () => {
			const md = await portableTextToMarkdown([{ _type: 'break' }], noopImage);
			expect(md).toBe('---');
		});
	});

	describe('note references', () => {
		it('renders note body as blockquote', async () => {
			const block: SanityBlock = {
				_type: 'note',
				title: 'A Note',
				body: 'This is the note content.'
			};
			const md = await portableTextToMarkdown([block], noopImage);
			expect(md).toBe('> This is the note content.');
		});

		it('renders multiline note body with > on each line', async () => {
			const block: SanityBlock = {
				_type: 'note',
				body: 'Line one\nLine two'
			};
			const md = await portableTextToMarkdown([block], noopImage);
			expect(md).toBe('> Line one\n> Line two');
		});

		it('skips note with no body', async () => {
			const md = await portableTextToMarkdown([{ _type: 'note', title: 'Empty' }], noopImage);
			expect(md).toBe('');
		});
	});

	describe('album references', () => {
		it('renders each album image via imageHandler', async () => {
			let callCount = 0;
			const handler = async (_b: SanityImageBlock) => {
				callCount++;
				return `https://r2.example.com/img${callCount}.webp`;
			};
			const block: SanityBlock = {
				_type: 'album',
				images: [
					{ alt: 'Photo 1', assetId: 'a1' },
					{ alt: 'Photo 2', assetId: 'a2' }
				]
			};
			const md = await portableTextToMarkdown([block], handler);
			expect(md).toBe('![Photo 1](https://r2.example.com/img1.webp)\n\n![Photo 2](https://r2.example.com/img2.webp)');
			expect(callCount).toBe(2);
		});
	});
});
