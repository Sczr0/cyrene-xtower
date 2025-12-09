<script lang="ts">
	import { tick } from 'svelte';
	import { getLocale } from '$lib/paraglide/runtime';
	import { defaultLocale, getLocaleText, type LocaleKey } from '$lib/i18n/locales';
	import type {
		GameKey,
		PoolKey,
		Mode,
		InitialState,
		GachaArgs,
		PullStats
	} from '$lib/gacha/core/types';

	type ModeKey = Mode;

	type FormState = {
		game: GameKey;
		pool: PoolKey;
		targetCount: number;
		up4C6: boolean;
		budget: number | null;
		mode: ModeKey;
		initialState: InitialState;
	};

	type GachaResult = {
		mode: ModeKey;
		pulls: PullStats;
		returns?: PullStats;
		success_rate?: number;
	};

	const currentLocale = (getLocale?.() as LocaleKey) ?? defaultLocale;
	const t = getLocaleText(currentLocale);
	const formText = t.form;
	const resultText = t.results;
	const heroText = t.hero;
	const docsText = t.docs;

	let enginePromise: Promise<typeof import('$lib/gacha/engine')> | null = null;

	function loadEngine() {
		if (!enginePromise) {
			enginePromise = import('$lib/gacha/engine');
		}
		return enginePromise;
	}

	function warmupEngine() {
		if (enginePromise) return;
		void loadEngine();
	}

	const poolOptions = t.form.poolOptions;

	let form: FormState = {
		game: 'genshin',
		pool: 'character',
		targetCount: 1,
		up4C6: false,
		budget: null,
		mode: 'expectation',
		initialState: {
			pity: 0,
			isGuaranteed: false,
			mingguangCounter: 0,
			fatePoint: 0
		}
	};

	let loading = false;
	let pendingMode: ModeKey | null = null;
	let errorMessage: string | null = null;
	let result: GachaResult | null = null;
	$: loadingMode = pendingMode ?? form.mode;

	$: availablePools = poolOptions[form.game];

	$: showMingguang = form.game === 'genshin' && form.pool === 'character';
	$: showFatePoint = form.game === 'genshin' && form.pool === 'weapon';
	$: showUp4C6 = form.pool === 'character';

	function onGameChange(value: GameKey) {
		form.game = value;
		const pools = poolOptions[value];
		if (!pools.find((p) => p.value === form.pool)) {
			form.pool = pools[0].value;
		}

		if (value !== 'genshin') {
			form.initialState.mingguangCounter = 0;
			form.initialState.fatePoint = 0;
		}
	}

	function onPoolChange(value: PoolKey) {
		form.pool = value;

		if (!(form.game === 'genshin' && value === 'character')) {
			form.initialState.mingguangCounter = 0;
		}

		if (!(form.game === 'genshin' && value === 'weapon')) {
			form.initialState.fatePoint = 0;
		}

		if (value !== 'character') {
			form.up4C6 = false;
		}
	}

	function formatNumber(value: number | undefined) {
		if (value === undefined || Number.isNaN(value)) return '-';
		return value.toFixed(2);
	}

	const pullBuckets = [
		{ key: 'p25', label: t.buckets.pullLabels.p25, color: 'bg-emerald-400' },
		{ key: 'p50', label: t.buckets.pullLabels.p50, color: 'bg-blue-400' },
		{ key: 'p75', label: t.buckets.pullLabels.p75, color: 'bg-orange-400' },
		{ key: 'p95', label: t.buckets.pullLabels.p95, color: 'bg-red-500' }
	] as const;

	function getPullValue(stats: PullStats, key: keyof PullStats): number | undefined {
		return stats[key];
	}

	function getNormalizedHeight(value: number | undefined, stats: PullStats): string {
		if (value === undefined || !Number.isFinite(value) || value <= 0) {
			return '0%';
		}

		const candidates = [stats.p95, stats.mean, 180].filter(
			(v): v is number => v !== undefined && Number.isFinite(v) && v > 0
		);

		const denom = candidates.length ? Math.max(...candidates) : 180;
		const ratio = Math.min(value / denom, 1);

		return `${(ratio * 100).toFixed(0)}%`;
	}

	type PullBucketKey = (typeof pullBuckets)[number]['key'];

	const bucketProbabilities: Record<PullBucketKey, number> = {
		p25: 0.25,
		p50: 0.5,
		p75: 0.75,
		p95: 0.95
	};

	type DistributionCurvePoint = {
		bucketKey: PullBucketKey;
		label: string;
		rawPull: number;
		probability: number;
		x: number;
		y: number;
	};

	type DistributionCurve = {
		points: DistributionCurvePoint[];
		minPull: number;
		maxPull: number;
	};

	type BudgetInfo =
		| {
				budgetPulls: number;
				x: number | null;
				zone: string | null;
		  }
		| null;

	function buildCurveLinePath(points: DistributionCurvePoint[]): string {
		if (!points.length) return '';

		const sorted = [...points].sort((a, b) => a.x - b.x);

		if (sorted.length === 1) {
			const p = sorted[0];
			return 'M ' + p.x + ' ' + p.y;
		}

		const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

		const segments: string[] = [];
		const offsetScale = 0.2; // Curve smoothness factor

		segments.push('M ' + sorted[0].x + ' ' + sorted[0].y);

		for (let i = 0; i < sorted.length - 1; i += 1) {
			const current = sorted[i];
			const next = sorted[i + 1];

			const dx = next.x - current.x;
			const dy = next.y - current.y;

			const mx = (current.x + next.x) / 2;
			const my = (current.y + next.y) / 2;

			const length = Math.hypot(dx, dy) || 1;
			const nx = (-dy / length) * offsetScale * length;
			const ny = (dx / length) * offsetScale * length;

			const cpx = clamp(mx + nx, 0, 100);
			const cpy = clamp(my + ny, 0, 100);

			segments.push('Q ' + cpx + ' ' + cpy + ' ' + next.x + ' ' + next.y);
		}

		return segments.join(' ');
	}

	function buildCurveAreaPath(curve: DistributionCurve): string {
		if (!curve.points.length) return '';

		const sorted = [...curve.points].sort((a, b) => a.x - b.x);
		const startX = sorted[0].x;
		const endX = sorted[sorted.length - 1].x;

		const segments = ['M ' + startX + ' 100'];
		for (const p of sorted) {
			segments.push('L ' + p.x + ' ' + p.y);
		}
		segments.push('L ' + endX + ' 100 Z');

		return segments.join(' ');
	}

	function classifyLuckZone(stats: PullStats, pulls: number | null): string | null {
		if (pulls === null || !Number.isFinite(pulls) || pulls <= 0) return null;

		const { p25, p50, p75, p95 } = stats;
		if (p25 === undefined || p50 === undefined || p75 === undefined || p95 === undefined) {
			return null;
		}

		if (pulls <= p25) return t.buckets.zoneLabels.p25;
		if (pulls <= p50) return t.buckets.zoneLabels.p50;
		if (pulls <= p75) return t.buckets.zoneLabels.p75;
		return t.buckets.zoneLabels.p95;
	}

	function getBudgetPulls(rawBudget: unknown): number | null {
		if (rawBudget === null || rawBudget === undefined || rawBudget === '') {
			return null;
		}

		const num = Number(rawBudget);
		if (!Number.isFinite(num) || num <= 0) return null;

		return num;
	}

	let distributionCurve: DistributionCurve | null = null;
	let budgetInfo: BudgetInfo = null;

	$: distributionCurve =
		result && result.mode === 'distribution'
			? (() => {
					const stats = result.pulls;

					const rawValues: {
						bucketKey: PullBucketKey;
						label: string;
						rawPull: number;
						probability: number;
					}[] = [];

					for (const bucket of pullBuckets) {
						const raw = getPullValue(stats, bucket.key);
						if (raw === undefined || !Number.isFinite(raw) || raw <= 0) continue;

						rawValues.push({
							bucketKey: bucket.key,
							label: bucket.label,
							rawPull: raw,
							probability: bucketProbabilities[bucket.key]
						});
					}

					if (!rawValues.length) return null;

					const minPull = Math.min(...rawValues.map((v) => v.rawPull));
					const maxPull = Math.max(...rawValues.map((v) => v.rawPull));
					const span = maxPull - minPull || 1;

					const points: DistributionCurvePoint[] = rawValues.map((v) => ({
						...v,
						x: ((v.rawPull - minPull) / span) * 100,
						y: 100 - v.probability * 100
					}));

					return { points, minPull, maxPull };
			  })()
			: null;

	$: budgetInfo =
		result && result.mode === 'distribution'
			? (() => {
					const budgetPulls = getBudgetPulls(form.budget);
					const zone = classifyLuckZone(result.pulls, budgetPulls);

					if (!budgetPulls || !distributionCurve) {
						return {
							budgetPulls: budgetPulls ?? 0,
							x: null,
							zone
						};
					}

					const { minPull, maxPull } = distributionCurve;
					const span = maxPull - minPull || 1;
					const clamped = Math.max(minPull, Math.min(budgetPulls, maxPull));
					const x = ((clamped - minPull) / span) * 100;

					return {
						budgetPulls,
						x,
						zone
					};
			  })()
			: null;

	function formatSuccessRate(value: number | undefined): string {
		const rate = Number(value);
		if (!Number.isFinite(rate) || rate < 0) return '-';
		if (rate < 0.01) return '< 0.01%';
		return `${rate.toFixed(2)}%`;
	}

	function buildArgs(mode: ModeKey): GachaArgs {
		const targetCount = Number(form.targetCount ?? 1);
		if (!Number.isFinite(targetCount) || targetCount <= 0) {
			throw new Error(t.form.errors.invalidTarget);
		}

		const budgetRaw = form.budget;
		const budget =
			budgetRaw === null || budgetRaw === undefined
				? null
				: Number(budgetRaw);
		if (budget !== null && (!Number.isFinite(budget) || budget <= 0)) {
			throw new Error(t.form.errors.invalidBudget);
		}

		const pity = Number(form.initialState.pity ?? 0);
		const mingguangCounter = Number(form.initialState.mingguangCounter ?? 0);
		const fatePoint = Number(form.initialState.fatePoint ?? 0);

		return {
			game: form.game,
			pool: form.pool,
			mode,
			targetCount,
			up4C6: form.up4C6,
			budget,
			initialState: {
				pity: Number.isFinite(pity) && pity >= 0 ? pity : 0,
				isGuaranteed: form.initialState.isGuaranteed,
				mingguangCounter:
					Number.isFinite(mingguangCounter) && mingguangCounter >= 0
						? mingguangCounter
						: 0,
				fatePoint:
					Number.isFinite(fatePoint) && fatePoint >= 0 ? fatePoint : 0
			}
		};
	}

	async function runLocally(args: GachaArgs): Promise<GachaResult> {
		const { runExpectation, runDistribution } = await loadEngine();

		if (args.mode === 'expectation') {
			const info = runExpectation(args);
			return {
				mode: args.mode,
				pulls: { mean: info.mean }
			};
		}

		const info = runDistribution(args);
		return {
			mode: args.mode,
			pulls: info.pulls,
			success_rate: info.successRate,
			returns: info.returns
		};
	}

	function applyResult(payload: GachaResult) {
		form.mode = payload.mode;
		result = payload;
	}

	async function submitClient(mode: ModeKey) {
		pendingMode = mode;
		loading = true;
		errorMessage = null;
		result = null;

		let args: GachaArgs;
		try {
			args = buildArgs(mode);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : t.form.errors.unknown;
			pendingMode = null;
			loading = false;
			return;
		}

		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));

		try {
			const payload = await runLocally(args);
			applyResult(payload);
		} finally {
			loading = false;
			pendingMode = null;
		}
	}
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">

	<main class="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
		<section class="flex flex-col gap-2">
			<p class="text-xs font-medium tracking-wide text-blue-600">
				{heroText.gameLine}
			</p>
			<h1 class="text-2xl font-semibold text-slate-900 sm:text-3xl">
				{heroText.title}
			</h1>
			<p class="max-w-2xl text-xs text-slate-500 sm:text-sm">
				{heroText.description}
			</p>
		</section>

		<section class="flex flex-col gap-6 lg:flex-row">
			<div
				class="w-full rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:sticky lg:top-24 lg:max-w-md"
				on:focusin={warmupEngine}
			>
				<div class="mb-4 flex items-center justify-between">
					<div>
						<h2 class="text-xs font-semibold text-slate-700">{formText.heading}</h2>
						<p class="mt-1 text-xs text-slate-400">
							{formText.subheading}
						</p>
					</div>
				</div>

				<div class="space-y-5 text-xs">
					<div class="space-y-2">
						<p class="text-[11px] font-semibold text-slate-500">{formText.basicsTitle}</p>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="field-game" class="mb-1 block text-[11px] font-medium text-slate-500">{formText.gameLabel}</label>
								<select id="field-game"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none ring-0 focus:border-blue-500 focus:bg-white"
									bind:value={form.game}
									on:change={(e) =>
										onGameChange((e.currentTarget.value || 'genshin') as GameKey)}
								>
									<option value="genshin">{formText.gameOptions.genshin}</option>
									<option value="hsr">{formText.gameOptions.hsr}</option>
									<option value="zzz">{formText.gameOptions.zzz}</option>
								</select>
							</div>

							<div>
								<label for="field-pool" class="mb-1 block text-[11px] font-medium text-slate-500">{formText.poolLabel}</label>
								<select id="field-pool"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none ring-0 focus:border-blue-500 focus:bg-white"
									bind:value={form.pool}
									on:change={(e) =>
										onPoolChange((e.currentTarget.value || 'character') as PoolKey)}
								>
									{#each availablePools as pool}
										<option value={pool.value}>{pool.label}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="field-target-count" class="mb-1 block text-[11px] font-medium text-slate-500">{formText.targetLabel}</label>
								<input id="field-target-count"
									type="number"
									min="1"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white"
									bind:value={form.targetCount}
								/>
							</div>
							<div>
								<label for="field-budget" class="mb-1 block text-[11px] font-medium text-slate-500">
									{formText.budgetLabel}
								</label>
								<input id="field-budget"
									type="number"
									min="1"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white"
									bind:value={form.budget}
								/>
							</div>
						</div>
					</div>

					<div class="space-y-2 border-t border-slate-100 pt-4">
						<p class="text-[11px] font-semibold text-slate-500">{formText.stateTitle}</p>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="field-pity" class="mb-1 block text-[11px] font-medium text-slate-500">
									{formText.pityLabel}
								</label>
								<input id="field-pity"
									type="number"
									min="0"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white"
									bind:value={form.initialState.pity}
								/>
							</div>

							<div>
								<label for="field-guarantee" class="mb-1 block text-[11px] font-medium text-slate-500">
									{formText.guaranteeLabel}
								</label>
								<select id="field-guarantee"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white"
									value={form.initialState.isGuaranteed ? 'true' : 'false'}
									on:change={(e) =>
										(form.initialState.isGuaranteed = e.currentTarget.value === 'true')}
								>
									{#each formText.guaranteeOptions as option}
										<option value={option.value ? 'true' : 'false'}>{option.label}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3">
							{#if showMingguang}
								<div>
								<label for="field-mingguang" class="mb-1 block text-[11px] font-medium text-slate-500">
									{formText.mingguangLabel}
								</label>
								<input id="field-mingguang"
									type="number"
									min="0"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white"
									bind:value={form.initialState.mingguangCounter}
								/>
							</div>
							{/if}

							{#if showFatePoint}
								<div>
								<label for="field-fate-point" class="mb-1 block text-[11px] font-medium text-slate-500">
									{formText.fateLabel}
								</label>
								<input id="field-fate-point"
									type="number"
									min="0"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white"
									bind:value={form.initialState.fatePoint}
								/>
							</div>
							{/if}
						</div>
					</div>

					<div class="space-y-2 border-t border-slate-100 pt-4">
						<p class="text-[11px] font-semibold text-slate-500">{formText.advancedTitle}</p>

						{#if showUp4C6}
							<div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
								<label class="flex items-center gap-2 text-[11px] text-slate-600">
                                    <input
										type="checkbox"
										class="h-3 w-3 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
										bind:checked={form.up4C6}
									/>
									<span>{formText.up4c6Label}</span>
								</label>
							</div>
						{:else}
							<p class="text-[11px] text-slate-400">
								{formText.up4c6Unavailable}
							</p>
						{/if}
					</div>

					<div class="border-t border-slate-100 pt-4">
						<div class="flex flex-col gap-2">
							<div class="flex flex-col gap-2 sm:flex-row">
								<button
									type="button"
									class="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
									on:mouseenter={warmupEngine}
									on:touchstart|passive={warmupEngine}
									on:click={() => submitClient('expectation')}
									disabled={loading}
								>
									{#if loading && loadingMode === 'expectation'}
										{formText.actions.expectationLoading}
									{:else}
										{formText.actions.expectationLabel}
									{/if}
								</button>
								<button
									type="button"
									class="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
									on:mouseenter={warmupEngine}
									on:touchstart|passive={warmupEngine}
									on:click={() => submitClient('distribution')}
									disabled={loading}
								>
									{#if loading && loadingMode === 'distribution'}
										{formText.actions.distributionLoading}
									{:else}
										{formText.actions.distributionLabel}
									{/if}
								</button>
							</div>
							<p class="text-[11px] text-slate-400">
								{formText.actions.helper}
							</p>
						</div>

						{#if errorMessage}
							<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-600">
								{errorMessage}
							</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex-1">
				<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
					<div class="mb-4 flex items-center justify-between">
						<div>
							<h2 class="text-sm font-semibold text-slate-900">{resultText.heading}</h2>
							<p class="mt-1 text-xs text-slate-400">
								{resultText.summary}
							</p>
							{#if result}
								<p class="mt-1 text-[11px] text-slate-400">
									{resultText.modeLabel}
									<span class="font-medium text-slate-600">
										{result.mode === 'expectation'
											? resultText.modeExpectation
											: resultText.modeDistribution}
									</span>
								</p>
							{/if}
						</div>
						<button
							type="button"
							class="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600"
							on:click={() => (result = null)}
						>
							{resultText.reset}
						</button>
					</div>

					{#if loading}
						<div class="mb-4 flex items-start gap-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
							<span class="mt-1 inline-flex h-3 w-3 items-center justify-center">
								<span class="block h-3 w-3 animate-spin rounded-full border border-blue-200 border-t-blue-600"></span>
							</span>
							<div class="flex flex-col gap-0.5">
								<p>
									{loadingMode === 'distribution'
										? resultText.loadingDistribution
										: resultText.loadingExpectation}
								</p>
								<p class="text-[11px] text-blue-500">
									{resultText.loadingNote}
								</p>
							</div>
						</div>
					{/if}

					{#if result}
						<div class="grid gap-4 md:grid-cols-3">
							<div class="rounded-xl border border-slate-100 bg-slate-50 p-4 md:col-span-1">
								<p class="text-[11px] text-slate-500">{resultText.meanCard.title}</p>
								<p class="mt-2 text-3xl font-semibold text-slate-900">
									{formatNumber(result.pulls.mean)}
								</p>
								<p class="mt-1 text-[11px] text-slate-400">
									{resultText.meanCard.subtitle}
									<span class="font-medium text-slate-700">
										{Math.ceil(result.pulls.mean || 0) * 160}
									</span>
								</p>
							</div>

							<div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
								<p class="text-[11px] text-slate-500">{resultText.successCard.title}</p>
								{#if result.success_rate !== undefined}
									<p class="mt-2 text-2xl font-semibold text-emerald-600">
										{formatSuccessRate(result.success_rate)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										{resultText.successCard.description}
									</p>
								{:else}
									<p class="mt-2 text-xl font-medium text-slate-400">-</p>
									<p class="mt-1 text-[11px] text-slate-400">
										{resultText.successCard.placeholder}
									</p>
								{/if}
							</div>

							<div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
								<p class="text-[11px] text-slate-500">{resultText.returnsCard.title}</p>
								{#if result.returns}
									<p class="mt-2 text-2xl font-semibold text-slate-900">
										{formatNumber(result.returns.mean)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										{resultText.returnsCard.description}
									</p>
								{:else}
									<p class="mt-2 text-xl font-medium text-slate-400">-</p>
									<p class="mt-1 text-[11px] text-slate-400">
										{resultText.returnsCard.placeholder}
									</p>
								{/if}
							</div>
						</div>

						{#if result.mode === 'distribution'}
							<div class="mt-6 grid gap-4 md:grid-cols-4">
								<div class="rounded-xl border border-slate-100 bg-white p-4">
									<p class="text-[11px] text-slate-500">{resultText.pullDistribution.p25.title}</p>
									<p class="mt-2 text-xl font-semibold text-slate-900">
										{formatNumber(result.pulls.p25)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										{resultText.pullDistribution.p25.description}
									</p>
								</div>
								<div class="rounded-xl border border-slate-100 bg-white p-4">
									<p class="text-[11px] text-slate-500">{resultText.pullDistribution.p50.title}</p>
									<p class="mt-2 text-xl font-semibold text-slate-900">
										{formatNumber(result.pulls.p50)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										{resultText.pullDistribution.p50.description}
									</p>
								</div>
								<div class="rounded-xl border border-slate-100 bg-white p-4">
									<p class="text-[11px] text-slate-500">{resultText.pullDistribution.p75.title}</p>
									<p class="mt-2 text-xl font-semibold text-slate-900">
										{formatNumber(result.pulls.p75)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										{resultText.pullDistribution.p75.description}
									</p>
								</div>
								<div class="rounded-xl border border-slate-100 bg-white p-4">
									<p class="text-[11px] text-slate-500">{resultText.pullDistribution.p95.title}</p>
									<p class="mt-2 text-xl font-semibold text-slate-900">
										{formatNumber(result.pulls.p95)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										{resultText.pullDistribution.p95.description}
									</p>
								</div>
							</div>

							{#if result.returns}
								<div class="mt-4">
									<p class="mb-2 text-[11px] font-semibold text-slate-500">
										{resultText.returnsDistributionTitle}
									</p>
									<div class="grid gap-4 md:grid-cols-4">
										<div class="rounded-xl border border-slate-100 bg-white p-4">
											<p class="text-[11px] text-slate-500">{resultText.returnDistribution.p25.title}</p>
											<p class="mt-2 text-xl font-semibold text-slate-900">
												{formatNumber(result.returns.p25)}
											</p>
											<p class="mt-1 text-[11px] text-slate-400">
												{resultText.returnDistribution.p25.description}
											</p>
										</div>
										<div class="rounded-xl border border-slate-100 bg-white p-4">
											<p class="text-[11px] text-slate-500">{resultText.returnDistribution.p50.title}</p>
											<p class="mt-2 text-xl font-semibold text-slate-900">
												{formatNumber(result.returns.p50)}
											</p>
											<p class="mt-1 text-[11px] text-slate-400">
												{resultText.returnDistribution.p50.description}
											</p>
										</div>
										<div class="rounded-xl border border-slate-100 bg-white p-4">
											<p class="text-[11px] text-slate-500">{resultText.returnDistribution.p75.title}</p>
											<p class="mt-2 text-xl font-semibold text-slate-900">
												{formatNumber(result.returns.p75)}
											</p>
											<p class="mt-1 text-[11px] text-slate-400">
												{resultText.returnDistribution.p75.description}
											</p>
										</div>
										<div class="rounded-xl border border-slate-100 bg-white p-4">
											<p class="text-[11px] text-slate-500">{resultText.returnDistribution.p95.title}</p>
											<p class="mt-2 text-xl font-semibold text-slate-900">
												{formatNumber(result.returns.p95)}
											</p>
											<p class="mt-1 text-[11px] text-slate-400">
												{resultText.returnDistribution.p95.description}
											</p>
										</div>
									</div>
								</div>
							{/if}
						{/if}
					{:else}
						<div
							class="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50"
						>
							<p class="text-xs text-slate-500">{resultText.empty.title}</p>
							<p class="mt-1 max-w-sm text-center text-[11px] text-slate-400">
								{resultText.empty.description}
							</p>
						</div>
					{/if}
				</div>
			</div>
		</section>

		<section class="grid gap-4 md:grid-cols-3">
			<div
				id="usage"
				class="rounded-2xl bg-white p-5 text-xs shadow-sm ring-1 ring-slate-100"
			>
				<h3 class="mb-2 text-[13px] font-semibold text-slate-900">{docsText.usageTitle}</h3>
				<ul class="space-y-1 text-[11px] text-slate-500">
					{#each docsText.usage as item}
						<li>{item}</li>
					{/each}
				</ul>
			</div>
			<div
				id="model"
				class="rounded-2xl bg-white p-5 text-xs shadow-sm ring-1 ring-slate-100"
			>
				<h3 class="mb-2 text-[13px] font-semibold text-slate-900">{docsText.modelTitle}</h3>
				<ul class="space-y-1 text-[11px] text-slate-500">
					{#each docsText.model as item}
						<li>{item}</li>
					{/each}
				</ul>
			</div>
			<div
				id="notice"
				class="rounded-2xl bg-white p-5 text-xs shadow-sm ring-1 ring-slate-100"
			>
				<h3 class="mb-2 text-[13px] font-semibold text-slate-900">{docsText.noticeTitle}</h3>
				<ul class="space-y-1 text-[11px] text-slate-500">
					{#each docsText.notice as item}
						<li>{item}</li>
					{/each}
				</ul>
			</div>
		</section>
	</main>
</div>
