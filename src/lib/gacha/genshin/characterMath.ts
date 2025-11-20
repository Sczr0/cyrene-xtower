// 原神角色池数学期望模型 (适配 5.0+ 捕获明光机制 & 55% 综合概率)
// 核心优化：O(N) DP求解 + 状态分布递推

import type { ExpectationResult, GachaArgs } from '../core/types';

const PITY_MAX = 90;
const MINGGUANG_MAX = 4; // 0, 1, 2, 3 (3代表必中状态)

// E_cache[isGuaranteed][mingguang][pity]
// 含义：在当前状态下，期望还需要多少抽能拿到当期 UP
let E_cache: Float64Array[][] | null = null;

// 基础概率配置
const PROB_BASE_WIN = 0.55; // 综合胜率 55%
const PROB_GUARANTEED_WIN = 1.0; // 大保底或明光捕获必中

function clampInt(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	if (value < min) return min;
	if (value > max) return max;
	return Math.floor(value);
}

function getProb5Star(pityIndex: number): number {
	const pull = pityIndex + 1;
	if (pull >= 90) return 1.0;
	if (pull < 74) return 0.006;
	return 0.006 + (pull - 73) * 0.06;
}

// 获取当前明光计数下的胜率
function getWinRate(mingguangCounter: number): number {
	// 规则：“若连续三次在第二次获取...下次...必定触发”
	// 意味着：计数为 3 时，胜率为 100%
	if (mingguangCounter >= 3) {
		return PROB_GUARANTEED_WIN;
	}
	// 否则综合概率为 55%
	return PROB_BASE_WIN;
}

// 计算 DP 表
function calculateTables() {
	// 初始化 E 表
	// E[1][mg][pity]: 大保底状态 (mg 其实不影响当前大保底出货，但影响出货后的下一轮)
	// E[0][mg][pity]: 小保底状态
	const E = Array.from({ length: 2 }, () =>
		Array.from({ length: MINGGUANG_MAX }, () => new Float64Array(PITY_MAX))
	);

	// --- 辅助计算：单次出货（不考虑重置，只拿到UP为止）的期望 ---

	// 1. 先算大保底 (isG=1)
	// 大保底必然出货，消耗只取决于 Pity。
	const E_Guaranteed_Cost = new Float64Array(PITY_MAX);
	for (let p = PITY_MAX - 1; p >= 0; p--) {
		const drop = getProb5Star(p);
		if (p === PITY_MAX - 1) {
			E_Guaranteed_Cost[p] = 1;
		} else {
			// 1 + (没出 * 继续抽)
			E_Guaranteed_Cost[p] = 1 + (1 - drop) * E_Guaranteed_Cost[p + 1];
		}
	}

	// 填充 E[1] (其实所有 mg 下都是一样的，因为大保底必然出)
	for (let mg = 0; mg < MINGGUANG_MAX; mg++) {
		for (let p = 0; p < PITY_MAX; p++) {
			E[1][mg][p] = E_Guaranteed_Cost[p];
		}
	}

	// 2. 再算小保底 (isG=0)
	for (let mg = 0; mg < MINGGUANG_MAX; mg++) {
		const winRate = getWinRate(mg);
		const loseRate = 1 - winRate;

		for (let p = PITY_MAX - 1; p >= 0; p--) {
			const drop = getProb5Star(p);
			
			// 如果这一发出金了：
			// - 赢了 (winRate): 结束。消耗 = 1。
			// - 歪了 (loseRate): 消耗 = 1 + 大保底期望(从0水位开始)。
			const costWhenDrop = 1 + loseRate * E_Guaranteed_Cost[0];

            if (p === PITY_MAX - 1) {
                E[0][mg][p] = costWhenDrop;
            } else {
                const costNext = E[0][mg][p + 1];
                E[0][mg][p] = drop * costWhenDrop + (1 - drop) * (1 + costNext);
            }
		}
	}

	E_cache = E;
}

function ensureTablesCalculated(): void {
	if (!E_cache) {
		calculateTables();
	}
}

export function getGenshinCharacterExpectation(args: GachaArgs): ExpectationResult {
	ensureTablesCalculated();
	if (!E_cache) throw new Error('Tables not initialized');

	const initial = args.initialState;
	const pity = clampInt(initial.pity, 0, PITY_MAX - 1);
	const mg = clampInt(initial.mingguangCounter, 0, MINGGUANG_MAX - 1);
	const isG = initial.isGuaranteed;
	const targetCount = Math.max(1, Math.floor(args.targetCount));

	// --- 阶段 1: 获取第 1 个目标 ---
	// 使用精确的初始状态
	let totalPulls = isG ? E_cache[1][mg][pity] : E_cache[0][mg][pity];

	// 如果只需要 1 个，直接返回
	if (targetCount === 1) {
		return { mean: totalPulls };
	}

	// --- 阶段 2: 获取后续目标 (2..N) ---
	// 这里需要维护一个“明光计数器”的概率分布。
	// 因为第 1 次出货后，状态会发生跃迁。
	// State 向量: [Prob(mg=0), Prob(mg=1), Prob(mg=2), Prob(mg=3)]
	// 每次出货后，Pity 归 0，isG 归 0 (因为只要出了UP，大保底和小保底状态都结束了，进入新的小保底)

	let stateDist = new Array(MINGGUANG_MAX).fill(0);

	// 2.1 计算第 1 次出货后的状态分布
	if (isG) {
		// 如果初始是大保底：
		// 必中。但是属于“歪了之后吃的大保底”，所以计数器 +1。
		// 规则：连续三次...必定触发。
		// 所以歪了(Lose) -> 计数+1。
		const nextMg = Math.min(mg + 1, MINGGUANG_MAX - 1);
		stateDist[nextMg] = 1.0;
	} else {
		// 如果初始是小保底：
		const winRate = getWinRate(mg);
		// 情况 A: 直接赢了 (Win) -> 计数器重置为 0 (因为要求“连续”歪)
		// 概率: winRate
		stateDist[0] += winRate;

		// 情况 B: 歪了，然后吃大保底 (Lose -> Guaranteed Win)
		// 概率: 1 - winRate
		// 结果: 计数器 +1
		if (winRate < 1.0) {
			const nextMg = Math.min(mg + 1, MINGGUANG_MAX - 1);
			stateDist[nextMg] += (1 - winRate);
		}
	}

	// 2.2 循环计算后续目标的期望
	// 每次我们都从 (Pity=0, isG=0, MG=distribution) 开始
	
	// 从 0 水位、小保底、特定 MG 开始抽到 1 个 UP 的期望
	const baseExpectations = E_cache[0].map(row => row[0]);

	for (let i = 1; i < targetCount; i++) {
		// 1. 累加当前这一轮的期望抽数
		let currentLoopExpectation = 0;
		for (let m = 0; m < MINGGUANG_MAX; m++) {
			if (stateDist[m] > 1e-9) {
				currentLoopExpectation += stateDist[m] * baseExpectations[m];
			}
		}
		totalPulls += currentLoopExpectation;

		// 2. 计算下一轮的状态分布转移
		const nextDist = new Array(MINGGUANG_MAX).fill(0);
		
		for (let m = 0; m < MINGGUANG_MAX; m++) {
			const prob = stateDist[m];
			if (prob <= 1e-9) continue;

			const winRate = getWinRate(m);
			
			// 赢了 (Win): MG 重置为 0
			nextDist[0] += prob * winRate;
			
			// 歪了 (Lose -> Guarantee): MG + 1
			if (winRate < 1.0) {
				const nextMg = Math.min(m + 1, MINGGUANG_MAX - 1);
				nextDist[nextMg] += prob * (1 - winRate);
			}
		}
		stateDist = nextDist;
	}

	return { mean: totalPulls };
}