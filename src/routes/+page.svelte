<script lang="ts">
	// 表单数据结构，和 Python 抽卡核心参数一一对应
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

	// 异步加载抽卡计算代码
	let enginePromise: Promise<typeof import('$lib/gacha/engine')> | null = null;

	function loadEngine() {
		if (!enginePromise) {
			// 首次调用时才发起真正的网络请求
			enginePromise = import('$lib/gacha/engine');
		}
		return enginePromise;
	}

	// 页面挂载后在后台预加载计算脚本
	function warmupEngine() {
		if (enginePromise) return;
		void loadEngine();
	}

	const poolOptions: Record<GameKey, { value: PoolKey; label: string }[]> = {
		genshin: [
			{ value: 'character', label: '角色池' },
			{ value: 'weapon', label: '武器池' }
		],
		hsr: [
			{ value: 'character', label: '角色池' },
			{ value: 'lightcone', label: '光锥池' }
		],
		zzz: [
			{ value: 'character', label: '角色池' },
			{ value: 'weapon', label: '音擎池' }
		]
	};

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
	let errorMessage: string | null = null;
	let result: GachaResult | null = null;

	// 根据当前选择的游戏动态限制卡池选项
	$: availablePools = poolOptions[form.game];

	// 控制不同游戏/卡池下表单项的显示
	$: showMingguang = form.game === 'genshin' && form.pool === 'character';
	$: showFatePoint = form.game === 'genshin' && form.pool === 'weapon';
	$: showUp4C6 = form.pool === 'character';

	function onGameChange(value: GameKey) {
		form.game = value;
		const pools = poolOptions[value];
		if (!pools.find((p) => p.value === form.pool)) {
			form.pool = pools[0].value;
		}

		// 非原神时清空仅对原神有效的字段，避免产生误导
		if (value !== 'genshin') {
			form.initialState.mingguangCounter = 0;
			form.initialState.fatePoint = 0;
		}
	}

	function onPoolChange(value: PoolKey) {
		form.pool = value;

		// 只有原神角色池才使用明光计数
		if (!(form.game === 'genshin' && value === 'character')) {
			form.initialState.mingguangCounter = 0;
		}

		// 只有原神武器池才使用定轨 / 命定点
		if (!(form.game === 'genshin' && value === 'weapon')) {
			form.initialState.fatePoint = 0;
		}

		// 角色池以外不需要 UP 四星满命开关
		if (value !== 'character') {
			form.up4C6 = false;
		}
	}

	function formatNumber(value: number | undefined) {
		if (value === undefined || Number.isNaN(value)) return '-';
		return value.toFixed(2);
	}

	const pullBuckets = [
		{ key: 'p25', label: '欧皇', color: 'bg-emerald-400' },
		{ key: 'p50', label: '正常', color: 'bg-blue-400' },
		{ key: 'p75', label: '偏非', color: 'bg-orange-400' },
		{ key: 'p95', label: '非酋', color: 'bg-red-500' }
	] as const;

	function getPullValue(stats: PullStats, key: keyof PullStats): number | undefined {
		return stats[key];
	}

	function getNormalizedHeight(value: number | undefined, stats: PullStats): string {
		if (value === undefined || !Number.isFinite(value) || value <= 0) {
			return '0%';
		}

		// 180 作为理论大保底附近的参考抽数
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

	// 根据分位点构造平滑曲线，用于 SVG 折线图
	function buildCurveLinePath(points: DistributionCurvePoint[]): string {
		if (!points.length) return '';

		const sorted = [...points].sort((a, b) => a.x - b.x);

		// 只有一个点时直接返回起点
		if (sorted.length === 1) {
			const p = sorted[0];
			return 'M ' + p.x + ' ' + p.y;
		}

		const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

		const segments: string[] = [];
		const offsetScale = 0.2; // 控制弯曲程度，值越大曲线越明显

		segments.push('M ' + sorted[0].x + ' ' + sorted[0].y);

		for (let i = 0; i < sorted.length - 1; i += 1) {
			const current = sorted[i];
			const next = sorted[i + 1];

			const dx = next.x - current.x;
			const dy = next.y - current.y;

			// 当前段的中点
			const mx = (current.x + next.x) / 2;
			const my = (current.y + next.y) / 2;

			// 法线方向偏移，确保控制点不与两点共线，从而形成平滑弯曲
			const length = Math.hypot(dx, dy) || 1;
			const nx = (-dy / length) * offsetScale * length;
			const ny = (dx / length) * offsetScale * length;

			const cpx = clamp(mx + nx, 0, 100);
			const cpy = clamp(my + ny, 0, 100);

			segments.push('Q ' + cpx + ' ' + cpy + ' ' + next.x + ' ' + next.y);
		}

		return segments.join(' ');
	}

	// 构造曲线下方面积的封闭路径，便于填充渐变背景
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

	// 根据预算抽数和分位点，判断大致落在欧/正常/偏非/非酋哪个区间
	function classifyLuckZone(stats: PullStats, pulls: number | null): string | null {
		if (pulls === null || !Number.isFinite(pulls) || pulls <= 0) return null;

		const { p25, p50, p75, p95 } = stats;
		if (p25 === undefined || p50 === undefined || p75 === undefined || p95 === undefined) {
			return null;
		}

		if (pulls <= p25) return '欧皇区';
		if (pulls <= p50) return '正常区';
		if (pulls <= p75) return '偏非区';
		return '非酋区';
	}

	// 将表单中的预算值解析为有效抽数
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

	// 响应式计算当前结果的抽数分布曲线坐标（基于 25/50/75/95% 分位点）
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

	// 计算预算抽数在曲线上的位置，并给出欧非区间标签
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

	// 纯前端抽卡计算入口：直接调用 TS 抽卡引擎
	async function submitClient(mode: ModeKey) {
		loading = true;
		errorMessage = null;
		result = null;

		try {
			const targetCount = Number(form.targetCount ?? 1);
			if (!Number.isFinite(targetCount) || targetCount <= 0) {
				throw new Error('目标数量必须为正整数');
			}

			const budgetRaw = form.budget;
			const budget =
				budgetRaw === null || budgetRaw === undefined
					? null
					: Number(budgetRaw);
			if (budget !== null && (!Number.isFinite(budget) || budget <= 0)) {
				throw new Error('预算必须为正整数或留空');
			}

			const pity = Number(form.initialState.pity ?? 0);
			const mingguangCounter = Number(form.initialState.mingguangCounter ?? 0);
			const fatePoint = Number(form.initialState.fatePoint ?? 0);

			const args: GachaArgs = {
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

			let pulls: PullStats;
			let returns: PullStats | undefined;
			let success_rate: number | undefined;

			// 等待异步加载抽卡计算模块
			const { runExpectation, runDistribution } = await loadEngine();

			if (mode === 'expectation') {
				const info = runExpectation(args);
				pulls = { mean: info.mean };
			} else {
				const info = runDistribution(args);
				pulls = info.pulls;
				success_rate = info.successRate;
				returns = info.returns;
			}

			form.mode = mode;
			result = {
				mode,
				pulls,
				returns,
				success_rate
			};
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : '未知错误，请稍后重试';
		} finally {
			loading = false;
		}
	}

	async function submit(mode: ModeKey) {
		loading = true;
		errorMessage = null;
		result = null;

		try {
			const body = {
				...form,
				mode,
				targetCount: Number(form.targetCount),
				budget:
					form.budget === null || form.budget === undefined ? null : Number(form.budget),
				initialState: {
					pity: Number(form.initialState.pity),
					isGuaranteed: form.initialState.isGuaranteed,
					mingguangCounter: Number(form.initialState.mingguangCounter),
					fatePoint: Number(form.initialState.fatePoint)
				}
			};

			const res = await fetch('/api/gacha', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			const data = await res.json();

			if (!data.ok) {
				throw new Error(data.error || '计算失败，请稍后重试');
			}

			const payload = data.data as {
				mode: ModeKey;
				pulls: PullStats;
				returns?: PullStats;
				success_rate?: number;
			};

			form.mode = payload.mode;
			result = {
				mode: payload.mode,
				pulls: payload.pulls,
				returns: payload.returns,
				success_rate: payload.success_rate
			};
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : '未知错误，请稍后重试';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<!-- 顶部导航 -->
	<header class="border-b bg-white/80 backdrop-blur">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-sm font-medium">
			<div class="flex items-center gap-2">
				<span class="text-base font-semibold text-slate-900">Gacha 期望查询</span>
				<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Beta</span>
			</div>
			<nav class="flex items-center gap-6 text-xs text-slate-500">
				<a href="#usage" class="hover:text-slate-900">使用说明</a>
				<a href="#model" class="hover:text-slate-900">模型说明</a>
				<a href="#notice" class="hover:text-slate-900">注意事项</a>
			</nav>
		</div>
	</header>

	<main class="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
		<section class="flex flex-col gap-2">
			<p class="text-xs font-medium tracking-wide text-blue-600">
				原神 / 崩坏：星穹铁道 / 绝区零
			</p>
			<h1 class="text-2xl font-semibold text-slate-900 sm:text-3xl">
				多游戏抽卡期望 & 概率计算器
			</h1>
			<p class="max-w-2xl text-xs text-slate-500 sm:text-sm">
				输入当前垫抽、保底状态与目标数量，一键获得期望抽数、预算达成概率和欧非分布区间。
			</p>
		</section>

		<section class="flex flex-col gap-6 lg:flex-row">
			<!-- 左侧参数表单 -->
			<div
				class="w-full rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:sticky lg:top-24 lg:max-w-md"
				on:focusin={warmupEngine}
			>
				<div class="mb-4 flex items-center justify-between">
					<div>
						<h2 class="text-xs font-semibold text-slate-700">抽卡参数</h2>
						<p class="mt-1 text-xs text-slate-400">
							按顺序选择游戏与卡池，并填写目标与当前状态
						</p>
					</div>
				</div>

				<div class="space-y-5 text-xs">
					<!-- 基础配置 -->
					<div class="space-y-2">
						<p class="text-[11px] font-semibold text-slate-500">基础配置</p>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="field-game" class="mb-1 block text-[11px] font-medium text-slate-500">游戏</label>
								<select id="field-game"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none ring-0 focus:border-blue-500 focus:bg-white"
									bind:value={form.game}
									on:change={(e) =>
										onGameChange((e.currentTarget.value || 'genshin') as GameKey)}
								>
									<option value="genshin">原神</option>
									<option value="hsr">崩坏：星穹铁道</option>
									<option value="zzz">绝区零</option>
								</select>
							</div>

							<div>
								<label for="field-pool" class="mb-1 block text-[11px] font-medium text-slate-500">卡池</label>
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
								<label for="field-target-count" class="mb-1 block text-[11px] font-medium text-slate-500">目标数量</label>
								<input id="field-target-count"
									type="number"
									min="1"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white"
									bind:value={form.targetCount}
								/>
							</div>
							<div>
								<label for="field-budget" class="mb-1 block text-[11px] font-medium text-slate-500">
									预算抽数（可选）
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

					<!-- 当前状态 -->
					<div class="space-y-2 border-t border-slate-100 pt-4">
						<p class="text-[11px] font-semibold text-slate-500">当前状态</p>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label for="field-pity" class="mb-1 block text-[11px] font-medium text-slate-500">
									当前垫抽
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
									保底状态
								</label>
								<select id="field-guarantee"
									class="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white"
									value={form.initialState.isGuaranteed ? 'true' : 'false'}
									on:change={(e) =>
										(form.initialState.isGuaranteed = e.currentTarget.value === 'true')}
								>
									<option value="false">小保底（上次抽到 UP）</option>
									<option value="true">大保底（上次抽到常驻）</option>
								</select>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3">
							{#if showMingguang}
								<div>
								<label for="field-mingguang" class="mb-1 block text-[11px] font-medium text-slate-500">
									明光计数（连续吃大保底多少次）（原神角色池）
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
									命定值（原神武器池）
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

					<!-- 高级选项 -->
					<div class="space-y-2 border-t border-slate-100 pt-4">
						<p class="text-[11px] font-semibold text-slate-500">高级选项</p>

						{#if showUp4C6}
							<div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
								<label class="flex items-center gap-2 text-[11px] text-slate-600">
                                    <input
										type="checkbox"
										class="h-3 w-3 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
										bind:checked={form.up4C6}
									/>
									<span>UP 四星已满命（角色池专用）</span>
								</label>
							</div>
						{:else}
							<p class="text-[11px] text-slate-400">
								当前卡池不支持 UP 四星满命配置，此选项自动忽略。
							</p>
						{/if}
					</div>

					<!-- 操作与错误提示 -->
					<div class="border-t border-slate-100 pt-4">
						<div class="flex flex-col gap-2">
							<div class="flex flex-col gap-2 sm:flex-row">
								<button
									type="button"
									class="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
									on:mouseenter={warmupEngine}
									on:click={() => submitClient('expectation')}
									disabled={loading}
								>
									{#if loading && form.mode === 'expectation'}
										计算中…
									{:else}
										计算期望抽数
									{/if}
								</button>
								<button
									type="button"
									class="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
									on:mouseenter={warmupEngine}
									on:click={() => submitClient('distribution')}
									disabled={loading}
								>
									{#if loading && form.mode === 'distribution'}
										模拟中…
									{:else}
										模拟分布与概率
									{/if}
								</button>
							</div>
							<p class="text-[11px] text-slate-400">
								期望模式计算更快，分布模式更适合评估预算与风险。
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

			<!-- 右侧统计仪表 -->
			<div class="flex-1">
				<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
					<div class="mb-4 flex items-center justify-between">
						<div>
							<h2 class="text-sm font-semibold text-slate-900">结果概览</h2>
							<p class="mt-1 text-xs text-slate-400">
								基于当前配置的抽卡期望与分布统计
							</p>
							{#if result}
								<p class="mt-1 text-[11px] text-slate-400">
									当前模式：
									<span class="font-medium text-slate-600">
										{result.mode === 'expectation' ? '数学期望' : '模拟分布'}
									</span>
								</p>
							{/if}
						</div>
						<button
							type="button"
							class="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600"
							on:click={() => (result = null)}
						>
							清空结果
						</button>
					</div>

					{#if result}
						<div class="grid gap-4 md:grid-cols-3">
							<div class="rounded-xl border border-slate-100 bg-slate-50 p-4 md:col-span-1">
								<p class="text-[11px] text-slate-500">期望抽数（平均值）</p>
								<p class="mt-2 text-3xl font-semibold text-slate-900">
									{formatNumber(result.pulls.mean)}
								</p>
								<p class="mt-1 text-[11px] text-slate-400">
									约折算原石 / 星琼 / 菲林：
									<span class="font-medium text-slate-700">
										{Math.ceil(result.pulls.mean || 0) * 160}
									</span>
								</p>
							</div>

							<div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
								<p class="text-[11px] text-slate-500">预算达成概率</p>
								{#if result.success_rate !== undefined}
									<p class="mt-2 text-2xl font-semibold text-emerald-600">
										{result.success_rate?.toFixed(2)}%
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										在预算抽数内完成目标的大致概率
									</p>
								{:else}
									<p class="mt-2 text-xl font-medium text-slate-400">-</p>
									<p class="mt-1 text-[11px] text-slate-400">
										仅在模拟模式且填写预算时展示
									</p>
								{/if}
							</div>

							<div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
								<p class="text-[11px] text-slate-500">副产物返还（平均值）</p>
								{#if result.returns}
									<p class="mt-2 text-2xl font-semibold text-slate-900">
										{formatNumber(result.returns.mean)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										包含星辉 / 星芒 / 信号余波等返还资源
									</p>
								{:else}
									<p class="mt-2 text-xl font-medium text-slate-400">-</p>
									<p class="mt-1 text-[11px] text-slate-400">
										部分卡池或数学模式下不提供返还统计
									</p>
								{/if}
							</div>
						</div>

						{#if result.mode === 'distribution'}
							<div class="mt-6 grid gap-4 md:grid-cols-4">
								<div class="rounded-xl border border-slate-100 bg-white p-4">
									<p class="text-[11px] text-slate-500">25% 欧皇线（抽数）</p>
									<p class="mt-2 text-xl font-semibold text-slate-900">
										{formatNumber(result.pulls.p25)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										约 25% 概率在该抽数内毕业
									</p>
								</div>
								<div class="rounded-xl border border-slate-100 bg-white p-4">
									<p class="text-[11px] text-slate-500">50% 中位线（抽数）</p>
									<p class="mt-2 text-xl font-semibold text-slate-900">
										{formatNumber(result.pulls.p50)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										一半玩家在该抽数前完成
									</p>
								</div>
								<div class="rounded-xl border border-slate-100 bg-white p-4">
									<p class="text-[11px] text-slate-500">75% 偏非线（抽数）</p>
									<p class="mt-2 text-xl font-semibold text-slate-900">
										{formatNumber(result.pulls.p75)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										超过该抽数属于偏非情况
									</p>
								</div>
								<div class="rounded-xl border border-slate-100 bg-white p-4">
									<p class="text-[11px] text-slate-500">95% 天选非酋线（抽数）</p>
									<p class="mt-2 text-xl font-semibold text-slate-900">
										{formatNumber(result.pulls.p95)}
									</p>
									<p class="mt-1 text-[11px] text-slate-400">
										极端情况下可能达到的抽数上界
									</p>
								</div>
							</div>

							{#if result.returns}
								<div class="mt-4">
									<p class="mb-2 text-[11px] font-semibold text-slate-500">
										副产物返还分布（星辉 / 星芒 / 信号余波）
									</p>
									<div class="grid gap-4 md:grid-cols-4">
										<div class="rounded-xl border border-slate-100 bg-white p-4">
											<p class="text-[11px] text-slate-500">25% 欧皇线（返还）</p>
											<p class="mt-2 text-xl font-semibold text-slate-900">
												{formatNumber(result.returns.p25)}
											</p>
											<p class="mt-1 text-[11px] text-slate-400">
												约 25% 概率返还不低于该数值
											</p>
										</div>
										<div class="rounded-xl border border-slate-100 bg-white p-4">
											<p class="text-[11px] text-slate-500">50% 中位线（返还）</p>
											<p class="mt-2 text-xl font-semibold text-slate-900">
												{formatNumber(result.returns.p50)}
											</p>
											<p class="mt-1 text-[11px] text-slate-400">
												一半模拟中返还不少于该数值
											</p>
										</div>
										<div class="rounded-xl border border-slate-100 bg-white p-4">
											<p class="text-[11px] text-slate-500">75% 偏非线（返还）</p>
											<p class="mt-2 text-xl font-semibold text-slate-900">
												{formatNumber(result.returns.p75)}
											</p>
											<p class="mt-1 text-[11px] text-slate-400">
												低于该返还量属于偏非情况
											</p>
										</div>
										<div class="rounded-xl border border-slate-100 bg-white p-4">
											<p class="text-[11px] text-slate-500">95% 极端线（返还）</p>
											<p class="mt-2 text-xl font-semibold text-slate-900">
												{formatNumber(result.returns.p95)}
											</p>
											<p class="mt-1 text-[11px] text-slate-400">
												极端欧皇情况下可能获得的返还上界
											</p>
										</div>
									</div>
								</div>
							{/if}
						{/if}

						<!--
						{#if false && result.mode === 'distribution'}
							<div class="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
								<div class="flex items-center justify-between">
									<p class="text-[11px] text-slate-500">抽数分布曲线</p>
									<p class="text-[11px] text-slate-400">
										横轴为抽数，纵轴为累计完成概率，曲线越靠左越欧皇
									</p>
								</div>

								<div class="mt-3 grid gap-3 md:grid-cols-[3fr_minmax(0,2fr)]">
									<div
										class="relative flex h-32 items-center justify-center rounded-lg bg-slate-100/70 px-3 py-2"
									>
										{#if distributionCurve}
											<svg
												viewBox="0 0 100 100"
												preserveAspectRatio="none"
												class="h-full w-full text-blue-400"
											>
												<defs>
													<linearGradient
														id="pull-probability-fill"
														x1="0"
														y1="0"
														x2="0"
														y2="1"
													>
														<stop offset="0%" stop-color="rgba(56,189,248,0.45)" />
														<stop offset="100%" stop-color="rgba(56,189,248,0.02)" />
													</linearGradient>
												</defs>

												<path
													d={buildCurveAreaPath(distributionCurve)}
													fill="url(#pull-probability-fill)"
													stroke="none"
												/>

												<path
													d={buildCurveLinePath(distributionCurve.points)}
													fill="none"
													stroke="currentColor"
													stroke-width="1.6"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>

												{#each distributionCurve.points as point}
													<circle
														cx={point.x}
														cy={point.y}
														r="1.6"
														fill="white"
														stroke="currentColor"
														stroke-width="0.8"
													>
														<title>
															{point.label} ~ {formatNumber(point.rawPull)} 抽（约 {Math.round(point.probability * 100)}% 完成）
														</title>
													</circle>
												{/each}

												<line
													x1="0"
													y1="100"
													x2="100"
													y2="100"
													stroke="rgba(148,163,184,0.9)"
													stroke-width="0.6"
												/>
											</svg>

											{#if budgetInfo && budgetInfo.x !== null}
												<div
													class="pointer-events-none absolute inset-y-3"
													style={`left: ${budgetInfo.x}%;`}
												>
													<div class="flex h-full items-stretch justify-center">
														<div class="h-full w-[1.5px] rounded-full bg-amber-500/80"></div>
													</div>
													<div
														class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 shadow-sm ring-1 ring-amber-100"
													>
														预算线 {budgetInfo.budgetPulls} 抽
													</div>
												</div>
											{/if}
										{:else}
											<p class="text-[11px] text-slate-400">
												当前结果缺少有效分位点，暂无法绘制分布曲线
											</p>
										{/if}
									</div>

									<div class="space-y-2">
										<p class="text-[11px] font-medium text-slate-500">欧非区间说明</p>
										<ul class="space-y-1 text-[11px] text-slate-500">
											<li>
												<span class="font-medium text-emerald-600">欧皇区：</span>
												在 25% 分位线之前完成，属于非常顺利的情况
											</li>
											<li>
												<span class="font-medium text-slate-600">正常区：</span>
												介于 25%-75% 分位之间，大部分玩家会落在这个带
											</li>
											<li>
												<span class="font-medium text-orange-500">偏非区：</span>
												超过 75% 分位线，说明运气偏差，需要更多抽数
											</li>
											<li>
												<span class="font-medium text-red-500">非酋区：</span>
												接近或超过 95% 分位线，属于极端情况下的坏运气
											</li>
										</ul>

										{#if budgetInfo && budgetInfo.zone}
											<p class="mt-1 text-[11px] text-slate-500">
												当前预算大致落在
												<span
													class={`font-semibold ${
										budgetInfo.zone === '欧皇区'
															? 'text-emerald-600'
											: budgetInfo.zone === '正常区'
																? 'text-slate-700'
											: budgetInfo.zone === '偏非区'
																	? 'text-orange-500'
																	: 'text-red-500'
													}`}
												>
													{budgetInfo.zone}
												</span>
												（参考 25/50/75/95% 分位抽数）
											</p>
										{:else}
											<p class="mt-1 text-[11px] text-slate-400">
												在左侧填写预算抽数后，将在曲线标记预算位置并判断欧非/非酋区间
											</p>
										{/if}
									</div>
								</div>
							</div>
						{/if}
						-->

						<!--
						{#if false && result.mode === 'distribution'}
							<div class="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
								<div class="flex items-center justify-between">
									<p class="text-[11px] text-slate-500">抽数分布概览</p>
									<p class="text-[11px] text-slate-400">柱子越高代表需要的抽数越多</p>
								</div>

								<div class="relative mt-3 flex h-28 items-end gap-3">
									{#if result.pulls.mean}
										<div
											class="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-200"
											style={`bottom: ${getNormalizedHeight(result.pulls.mean, result.pulls)};`}
										/>
										<div
											class="pointer-events-none absolute right-0 translate-y-1 text-[10px] text-slate-400"
											style={`bottom: ${getNormalizedHeight(result.pulls.mean, result.pulls)};`}
										>
											均值
										</div>
									{/if}

									<div class="relative z-10 flex h-full w-full items-end gap-3">
										{#each pullBuckets as bucket}
											{@const value = getPullValue(result.pulls, bucket.key)}
											<div class="flex-1">
												<div
													class={`mx-auto w-4 rounded-t-full ${bucket.color}`}
													style={`height: ${getNormalizedHeight(value, result.pulls)};`}
													title={bucket.label + ' ~ ' + formatNumber(value ?? 0) + ' 抽'}
												/>
												<p class="mt-1 text-center text-[10px] text-slate-500">
													{bucket.label}
												</p>
											</div>
										{/each}
									</div>
								</div>
							</div>
						{/if}
						-->

					{:else}
						<div
							class="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50"
						>
							<p class="text-xs text-slate-500">尚未计算结果</p>
							<p class="mt-1 max-w-sm text-center text-[11px] text-slate-400">
								在左侧配置参数后，点击「计算期望抽数」或「模拟分布与概率」开始计算。
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
				<h3 class="mb-2 text-[13px] font-semibold text-slate-900">使用说明</h3>
				<ul class="space-y-1 text-[11px] text-slate-500">
					<li>选择游戏与卡池，并填写目前垫抽与保底状态。</li>
					<li>「期望抽数」使用数学模型进行快速估计。</li>
					<li>「模拟分布」使用蒙特卡洛模拟，给出概率区间与预算达成概率。</li>
				</ul>
			</div>
			<div
				id="model"
				class="rounded-2xl bg-white p-5 text-xs shadow-sm ring-1 ring-slate-100"
			>
				<h3 class="mb-2 text-[13px] font-semibold text-slate-900">模型说明</h3>
				<ul class="space-y-1 text-[11px] text-slate-500">
					<li>角色池下的蒙特卡洛模拟次数更高，因此计算时间略长。</li>
				</ul>
			</div>
			<div
				id="notice"
				class="rounded-2xl bg-white p-5 text-xs shadow-sm ring-1 ring-slate-100"
			>
				<h3 class="mb-2 text-[13px] font-semibold text-slate-900">注意事项</h3>
				<ul class="space-y-1 text-[11px] text-slate-500">
					<li>所有结果仅供参考，不代表官方概率与实际抽卡结果。</li>
				</ul>
			</div>
		</section>
	</main>
</div>

