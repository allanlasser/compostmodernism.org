import { marked } from 'marked';

marked.setOptions({
	// gfm: GitHub-Flavoured Markdown (auto-link URLs, tables, strikethrough)
	gfm: true,
	// breaks: false because we want a blank line to make a paragraph, the way
	// CommonMark intends. Single newlines stay as soft wraps, not <br>.
	breaks: false
});

export function renderMarkdown(body: string): string {
	if (!body) return '';
	// marked returns string | Promise<string>; we use the sync parser to keep
	// the call signature simple in templates.
	return marked.parse(body, { async: false }) as string;
}
