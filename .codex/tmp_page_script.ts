	// 琛ㄥ崟鏁版嵁缁撴瀯锛屽拰 Python 鎶藉崱鏍稿績鍙傛暟涓€涓€瀵瑰簲
	type GameKey = 'genshin' | 'hsr' | 'zzz';
	type PoolKey = 'character' | 'weapon' | 'lightcone';
	type ModeKey = 'expectation' | 'distribution';

	type PullStats = {
		mean: number;
		p25?: number;
		p50?: number;
		p75?: number;
		p90?: number;
		p95?: number;
	};

	type InitialState = {
		pity: number;
		isGuaranteed: boolean;
		mingguangCounter: number;
		fatePoint: number;
	};

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

	// 鏍规嵁褰撳墠閫夋嫨鐨勬父鎴忓姩鎬侀檺鍒跺崱姹犻€夐」
	$: availablePools = poolOptions[form.game];

	// 鎺у埗涓嶅悓娓告垙/鍗℃睜涓嬭〃鍗曢」鐨勬樉绀?	$: showMingguang = form.game === 'genshin' && form.pool === 'character';
	$: showFatePoint = form.game === 'genshin' && form.pool === 'weapon';
	$: showUp4C6 = form.pool === 'character';

	function onGameChange(value: GameKey) {
		form.game = value;
		const pools = poolOptions[value];
		if (!pools.find((p) => p.value === form.pool)) {
			form.pool = pools[0].value;
		}

		// 闈炲師绁炴椂娓呯┖浠呭鍘熺鏈夋晥鐨勫瓧娈碉紝閬垮厤浜х敓璇
		if (value !== 'genshin') {
			form.initialState.mingguangCounter = 0;
			form.initialState.fatePoint = 0;
		}
	}

	function onPoolChange(value: PoolKey) {
		form.pool = value;

		// 鍙湁鍘熺瑙掕壊姹犳墠浣跨敤鏄庡厜璁℃暟
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
	function formatNumber(value: number | undefined) {
		if (value === undefined || Number.isNaN(value)) return '-';
		return value.toFixed(2);
	}

	const pullBuckets = [
		{ key: 'p25', label: '娆х殗', color: 'bg-emerald-400' },
		{ key: 'p50', label: '姝ｅ父', color: 'bg-blue-400' },
		{ key: 'p75', label: '鍋忛潪', color: 'bg-orange-400' },
		{ key: 'p95', label: '闈為厠', color: 'bg-red-500' }
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

        const clamp = (value: number, min: number, max: number) =>
            Math.max(min, Math.min(max, value));

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

	}

	// 鏍规嵁棰勭畻鎶芥暟鍜屽垎浣嶇偣锛屽垽鏂ぇ鑷磋惤鍦ㄦ鐨?姝ｅ父/鍋忛潪/闈為厠鍝釜鍖洪棿
	function classifyLuckZone(stats: PullStats, pulls: number | null): string | null {
		if (pulls === null || !Number.isFinite(pulls) || pulls <= 0) return null;

		const { p25, p50, p75, p95 } = stats;
		if (
			p25 === undefined ||
			p50 === undefined ||
			p75 === undefined ||
			p95 === undefined
		) {
			return null;
		}

		if (pulls <= p25) return '欧皇区';
		if (pulls <= p50) return '正常区';
		if (pulls <= p75) return '偏非区';
		return '非酋区';
	}

	// 灏嗚〃鍗曚腑鐨勯绠楀€艰В鏋愪负鏈夋晥鎶芥暟
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

	// 鍝嶅簲寮忚绠楀綋鍓嶇粨鏋滅殑鎶芥暟鍒嗗竷鏇茬嚎鍧愭爣锛堝熀浜?25/50/75/95% 鍒嗕綅鐐癸級
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

	// 璁＄畻棰勭畻鎶芥暟鍦ㄦ洸绾夸笂鐨勪綅缃紝骞剁粰鍑烘闈炲尯闂存爣绛?	$: budgetInfo =
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
					form.budget === null || form.budget === undefined
						? null
						: Number(form.budget),
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
				throw new Error(data.error || '璁＄畻澶辫触锛岃绋嶅悗閲嶈瘯');
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
			errorMessage =
				error instanceof Error ? error.message : '鏈煡閿欒锛岃绋嶅悗閲嶈瘯';
		} finally {
			loading = false;
		}
	}
