<script lang="ts">
	interface Props {
		date: number;
	}

	let { date }: Props = $props();

	const formatter = new Intl.DateTimeFormat('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

	let timestamp = $derived(
		formatter
			.format(new Date(date))
			.replace(',', '')
			.replace(/(\d{2}:\d{2}) (\w+ \d+) (\d{4})/, '$1 $2, $3')
	);
</script>

<time datetime={new Date(date).toISOString()}>{timestamp}</time>

<style>
	time {
		font-size: var(--size-meta);
		color: var(--color-ink-soft);
	}
</style>
