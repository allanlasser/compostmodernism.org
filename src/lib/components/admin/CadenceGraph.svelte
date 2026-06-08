<script lang="ts">
	interface CadenceEntry {
		date: string;
		count: number;
	}

	interface Props {
		cadence: CadenceEntry[];
	}

	let { cadence }: Props = $props();

	const CELL = 11;
	const GAP = 2;
	const STEP = CELL + GAP;
	const MONTH_H = 18;
	const DAY_LABEL_W = 28;
	const NUM_WEEKS = 52;
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const W = DAY_LABEL_W + NUM_WEEKS * STEP - GAP;
	const H = MONTH_H + 7 * STEP - GAP;

	function getLevel(count: number): number {
		if (count === 0) return 0;
		if (count === 1) return 1;
		if (count === 2) return 2;
		if (count <= 4) return 3;
		return 4;
	}

	interface GridCell {
		dateStr: string;
		count: number;
		level: number;
		future: boolean;
	}

	interface MonthLabel {
		x: number;
		label: string;
	}

	const { weeks, monthLabels } = $derived.by(() => {
		const countMap = new Map<string, number>(cadence.map(({ date, count }) => [date, count]));

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const start = new Date(today);
		start.setDate(start.getDate() - NUM_WEEKS * 7);
		start.setDate(start.getDate() - start.getDay()); // back to Sunday

		const weeks: GridCell[][] = [];
		const cur = new Date(start);
		while (weeks.length < NUM_WEEKS) {
			const week: GridCell[] = [];
			for (let d = 0; d < 7; d++) {
				const dateStr = cur.toISOString().slice(0, 10);
				const future = cur > today;
				const count = future ? 0 : (countMap.get(dateStr) ?? 0);
				week.push({ dateStr, count, level: future ? -1 : getLevel(count), future });
				cur.setDate(cur.getDate() + 1);
			}
			weeks.push(week);
		}

		const monthLabels: MonthLabel[] = [];
		let lastMonth = -1;
		weeks.forEach((week, wi) => {
			const first = week.find((c) => !c.future);
			if (!first) return;
			const m = new Date(first.dateStr + 'T00:00:00Z').getMonth();
			if (m !== lastMonth) {
				const x = DAY_LABEL_W + wi * STEP;
				const prev = monthLabels[monthLabels.length - 1];
				if (!prev || x - prev.x >= STEP * 2) {
					monthLabels.push({ x, label: MONTHS[m] });
					lastMonth = m;
				}
			}
		});

		return { weeks, monthLabels };
	});

	function cellFill(level: number): string {
		if (level < 0) return 'transparent';
		return `var(--cadence-${level})`;
	}

	function cellX(wi: number): number {
		return DAY_LABEL_W + wi * STEP;
	}

	function cellY(di: number): number {
		return MONTH_H + di * STEP;
	}

	function dayTitle(count: number, dateStr: string): string {
		const label = count === 0 ? 'No posts' : count === 1 ? '1 post' : `${count} posts`;
		return `${label} — ${dateStr}`;
	}
</script>

<div class="cadence-wrap">
	<svg
		width={W}
		height={H}
		viewBox="0 0 {W} {H}"
		aria-label="Posting cadence for the past year"
		role="img"
	>
		{#each monthLabels as { x, label }}
			<text {x} y={13} class="graph-label">{label}</text>
		{/each}

		<text x={DAY_LABEL_W - 4} y={cellY(1) + CELL / 2} dominant-baseline="central" class="graph-label day">Mon</text>
		<text x={DAY_LABEL_W - 4} y={cellY(3) + CELL / 2} dominant-baseline="central" class="graph-label day">Wed</text>
		<text x={DAY_LABEL_W - 4} y={cellY(5) + CELL / 2} dominant-baseline="central" class="graph-label day">Fri</text>

		{#each weeks as week, wi}
			{#each week as { dateStr, count, level, future }, di}
				{#if !future}
					<rect
						x={cellX(wi)}
						y={cellY(di)}
						width={CELL}
						height={CELL}
						rx={2}
						style="fill: {cellFill(level)}"
					>
						<title>{dayTitle(count, dateStr)}</title>
					</rect>
				{/if}
			{/each}
		{/each}
	</svg>
</div>

<style>
	.cadence-wrap {
		overflow-x: auto;
		--cadence-0: var(--color-surface-subtle);
		--cadence-1: oklch(80% 0.1 138 / 0.55);
		--cadence-2: oklch(65% 0.16 140);
		--cadence-3: oklch(50% 0.19 141);
		--cadence-4: oklch(36% 0.18 140);

		@media (prefers-color-scheme: dark) {
			--cadence-1: oklch(48% 0.13 140 / 0.6);
			--cadence-2: oklch(60% 0.18 140);
			--cadence-3: oklch(72% 0.2 140);
			--cadence-4: oklch(84% 0.2 140);
		}
	}

	.graph-label {
		fill: var(--color-ink-dim);
		font-size: 10px;
		font-family: var(--font-serif);
	}

	.graph-label.day {
		text-anchor: end;
	}
</style>
