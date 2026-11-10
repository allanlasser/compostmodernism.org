<script lang="ts">
	import { SITE_NAME, type SocialMeta } from '$lib/social';

	interface Props {
		meta: SocialMeta;
	}

	let { meta }: Props = $props();
</script>

<svelte:head>
	<title>{meta.documentTitle}</title>
	<link rel="canonical" href={meta.url} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:type" content={meta.type} />
	<meta property="og:title" content={meta.title} />
	<meta property="og:url" content={meta.url} />
	{#if meta.description}
		<meta name="description" content={meta.description} />
		<meta property="og:description" content={meta.description} />
	{/if}
	{#if meta.image}
		<meta property="og:image" content={meta.image} />
		{#if meta.imageAlt}
			<meta property="og:image:alt" content={meta.imageAlt} />
		{/if}
	{/if}
	{#if meta.publishedTime}
		<meta property="article:published_time" content={meta.publishedTime} />
	{/if}
	<meta name="twitter:card" content={meta.image ? 'summary_large_image' : 'summary'} />
</svelte:head>
