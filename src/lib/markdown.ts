import { marked } from 'marked';
import smartquotes from 'smartquotes';

marked.setOptions({
	// gfm: GitHub-Flavoured Markdown (auto-link URLs, tables, strikethrough)
	gfm: true,
	// breaks: false because we want a blank line to make a paragraph, the way
	// CommonMark intends. Single newlines stay as soft wraps, not <br>.
	breaks: false
});

// Apply smartquotes to leaf text tokens in the AST, before marked renders to HTML.
// This way attribute values and code spans/blocks are left untouched.
marked.use({
	walkTokens(token) {
		if (token.type === 'text' && !token.tokens && typeof token.text === 'string') {
			token.text = smartquotes.string(token.text);
		}
	}
});

export function renderMarkdown(body: string): string {
	if (!body) return '';
	// marked returns string | Promise<string>; we use the sync parser to keep
	// the call signature simple in templates.
	return marked.parse(body, { async: false }) as string;
}
