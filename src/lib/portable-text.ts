export interface SanitySpan {
	_type: 'span';
	text: string;
	marks?: string[];
}

export interface SanityMarkDef {
	_key: string;
	_type: string;
	href?: string;
}

export interface SanityTextBlock {
	_type: 'block';
	_key?: string;
	style?: string;
	listItem?: 'bullet' | 'number';
	level?: number;
	children: SanitySpan[];
	markDefs?: SanityMarkDef[];
}

export interface SanityImageBlock {
	_type: 'image';
	_key?: string;
	alt?: string;
	caption?: string;
	assetUrl?: string;
	assetId?: string;
}

export interface SanityCodeBlock {
	_type: 'code';
	_key?: string;
	language?: string;
	filename?: string;
	code: string;
}

export interface SanityBreakBlock {
	_type: 'break';
	_key?: string;
	style?: string;
}

export interface SanityNoteReference {
	_type: 'note';
	_key?: string;
	title?: string;
	body?: string;
}

export interface SanityAlbumReference {
	_type: 'album';
	_key?: string;
	title?: string;
	images?: Array<{
		alt?: string;
		assetUrl?: string;
		assetId?: string;
	}>;
}

export type SanityBlock =
	| SanityTextBlock
	| SanityImageBlock
	| SanityCodeBlock
	| SanityBreakBlock
	| SanityNoteReference
	| SanityAlbumReference;

function renderSpans(children: SanitySpan[], markDefs: SanityMarkDef[]): string {
	const defMap = new Map(markDefs.map((d) => [d._key, d]));

	return children
		.map((span) => {
			let text = span.text;
			const marks = span.marks ?? [];

			// Collect link annotation if present (applied outermost)
			let linkHref: string | undefined;
			for (const mark of marks) {
				const def = defMap.get(mark);
				if (def?._type === 'link') linkHref = def.href;
			}

			// Apply decorators inside-out
			if (marks.includes('code')) text = `\`${text}\``;
			if (marks.includes('strong')) text = `**${text}**`;
			if (marks.includes('em')) text = `_${text}_`;

			if (linkHref) text = `[${text}](${linkHref})`;

			return text;
		})
		.join('');
}

function renderTextBlock(block: SanityTextBlock): string {
	const markDefs = block.markDefs ?? [];
	const inline = renderSpans(block.children, markDefs);
	const style = block.style ?? 'normal';
	const level = block.level ?? 1;
	const indent = '  '.repeat(Math.max(0, level - 1));

	if (block.listItem === 'bullet') return `${indent}- ${inline}`;
	if (block.listItem === 'number') return `${indent}1. ${inline}`;

	switch (style) {
		case 'h1': return `# ${inline}`;
		case 'h2': return `## ${inline}`;
		case 'h3': return `### ${inline}`;
		case 'h4': return `#### ${inline}`;
		case 'blockquote': return `> ${inline}`;
		default: return inline;
	}
}

export async function portableTextToMarkdown(
	blocks: SanityBlock[],
	imageHandler: (block: SanityImageBlock) => Promise<string>
): Promise<string> {
	const parts: string[] = [];

	for (const block of blocks) {
		if (block._type === 'block') {
			parts.push(renderTextBlock(block as SanityTextBlock));
		} else if (block._type === 'image') {
			const url = await imageHandler(block as SanityImageBlock);
			const img = block as SanityImageBlock;
			const alt = img.alt ?? '';
			let line = `![${alt}](${url})`;
			if (img.caption) line += `\n_${img.caption}_`;
			parts.push(line);
		} else if (block._type === 'code') {
			const cb = block as SanityCodeBlock;
			const lang = cb.language ?? '';
			const header = cb.filename ? `\`\`\`${lang} ${cb.filename}` : `\`\`\`${lang}`;
			parts.push(`${header}\n${cb.code}\n\`\`\``);
		} else if (block._type === 'break') {
			parts.push('---');
		} else if (block._type === 'note') {
			const note = block as SanityNoteReference;
			if (note.body) {
				const quoted = note.body
					.split('\n')
					.map((line) => `> ${line}`)
					.join('\n');
				parts.push(quoted);
			}
		} else if (block._type === 'album') {
			const album = block as SanityAlbumReference;
			if (album.images) {
				for (const img of album.images) {
					const url = await imageHandler(img as SanityImageBlock);
					parts.push(`![${img.alt ?? ''}](${url})`);
				}
			}
		}
	}

	// Join blocks: list items that are adjacent should not get double blank lines
	const lines: string[] = [];
	for (let i = 0; i < parts.length; i++) {
		lines.push(parts[i]);
		if (i < parts.length - 1) {
			const curr = parts[i];
			const next = parts[i + 1];
			const currIsList = /^(\s*[-*]|\s*\d+\.)/.test(curr);
			const nextIsList = /^(\s*[-*]|\s*\d+\.)/.test(next);
			if (!(currIsList && nextIsList)) {
				lines.push('');
			}
		}
	}

	return lines.join('\n').trimEnd();
}
