export interface PostFixture {
	body: string;
	title?: string;
	url?: string;
	tags?: string[];
}

export interface ImageFixture {
	key: string;
	title?: string;
	alt?: string;
	caption?: string;
	credit?: string;
}

// Image ledger entries inserted directly into the `images` table by seed.ts
// (bypassing /api/upload — no R2 round-trip needed). Keys mirror what the
// upload endpoint would generate: images/YYYY/MM/DD/<8-hex>.webp.
export const imageFixtures: ImageFixture[] = [
	{
		key: 'images/2026/05/14/8b3a2c1d.webp',
		alt: 'A snake of basil roots wrapped tight inside a clay pot'
	},
	{
		key: 'images/2026/05/15/4e7f019b.webp',
		title: 'Compost steam',
		alt: 'Steam rising from a damp compost pile in the early morning'
	},
	{
		key: 'images/2026/05/15/c5d2e6a8.webp',
		alt: 'A round loaf of sourdough, scored across the top, cooling on a wire rack',
		credit: 'photo: kitchen counter, sunlight'
	}
];

// `{{IMG}}` is replaced by seed.ts with $R2_PUBLIC_URL before POSTing.
// setPostImages picks the keys back out by matching against that prefix.
export const fixtures: PostFixture[] = [
	{
		body:
			'I really enjoy writing in Markdown, working with SvelteKit, and would like to have something simple that I can post to from my phone or my laptop.',
		tags: ['hello-world']
	},
	{
		title: 'Compostmodernism, a blog about decay and renewal',
		body:
			'I have my website, compostmodernism.org, that I’d like to turn into a blog. I don’t want a complicated stack, and would ideally like to keep things as statically generated and “file-first” as possible — but would still really like the ability to blog small updates on the go.',
		tags: ['hello-world', 'meta']
	},
	{
		body:
			'Spent the morning re-potting the basil. The roots had wrapped the whole inside of the old container into a single dense knot — somehow alive, somehow choking itself.\n\n![Basil rootbound]({{IMG}}/images/2026/05/14/8b3a2c1d.webp)',
		tags: ['garden']
	},
	{
		title: 'Why I love Svelte',
		url: 'https://svelte.dev/blog/runes',
		body: 'Runes are such a clean redesign of reactivity. Worth a read if you’ve been on the fence.',
		tags: ['svelte', 'reading']
	},
	{
		body:
			'A short one: the compost pile is finally warm again.\n\n![]({{IMG}}/images/2026/05/15/4e7f019b.webp)',
		tags: ['garden']
	},
	{
		title: 'On small software',
		body:
			'There is a kind of website that fits on one floppy disk and runs forever. I want to make more of those — fewer abstractions, fewer dependencies, more text.',
		tags: ['meta', 'writing']
	},
	{
		body:
			'Made bread again. The starter is two years old now and produces a remarkably consistent loaf — almost suspicious in its reliability.\n\n![Sourdough loaf cooling]({{IMG}}/images/2026/05/15/c5d2e6a8.webp)',
		tags: ['kitchen']
	},
	{
		title: 'A tiny snippet',
		body:
			'A useful one-liner I keep reaching for: `npm run check` runs `svelte-check` across both `.ts` and `.svelte` files.\n\nFenced blocks look like this:\n\n```ts\nexport function renderMarkdown(body: string): string {\n\tif (!body) return \'\';\n\treturn marked.parse(body, { async: false }) as string;\n}\n```\n\nAnd a longer line that should scroll horizontally inside the block instead of wrapping awkwardly:\n\n```sh\ndocker compose run --rm app node -e "console.log(require(\'better-sqlite3\')(\'posts.db\').prepare(\'SELECT count(*) AS n FROM posts\').get())"\n```',
		tags: ['meta']
	}
];
