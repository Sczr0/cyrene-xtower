// 原神武器池期望模型

import type { ExpectationResult, GachaArgs } from '../core/types';

const PITY_MAX = 80;
// 5.0改版后，命定值上限为1。即：0(未满), 1(满/必中)
const FATE_MAX = 2; 

// E_cache[fate][pity]
// 这里不再需要单独区分 isGuaranteed，因为命定值机制已经覆盖了保底逻辑。
// 在新规则下：
// - 只要没抽到定轨武器，命定值+1 -> 变成1 (满) -> 下次必中。
// - 抽到定轨武器 -> 命定值归0。
// - 所谓的“小保底/大保底”逻辑被定轨逻辑完全包裹。
//   (例如：歪常驻->命定值+1->下次必中定轨；歪另一把UP->命定值+1->下次必中定轨)
// 所以状态空间只需二维：[Fate][Pity]
let E_cache: Float64Array[] | null = null;

function clampInt(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	if (value < min) return min;
	if (value > max) return max;
	return Math.floor(value);
}

function getProb5Star(pityIndex: number): number {
	// 武器池概率：前62抽 0.7%，63抽开始线性增加
	const pull = pityIndex + 1;
	if (pull >= 80) return 1.0;
	if (pull < 63) return 0.007;
	return 0.007 + (pull - 62) * 0.07;
}

// 获取“直接抽中定轨武器”的概率
function getWinRate(fatePoint: number): number {
	// 如果命定值满了(1)，必中
	if (fatePoint >= 1) return 1.0;
	
	// 没满(0)的情况：
	// 基础概率：75% 是 UP 武器。
	// 两把 UP 均分，所以定轨的那把占 37.5% (0.375)
	return 0.375;
}

function calculateTables() {
	// E[fate][pity]
	// fate: 0 或 1
	const E = Array.from({ length: FATE_MAX }, () => new Float64Array(PITY_MAX));

	// 1. 先解命定值满 (Fate=1) 的情况
	// 必中定轨，不涉及歪。
	for (let p = PITY_MAX - 1; p >= 0; p--) {
		const drop = getProb5Star(p);
		if (p === PITY_MAX - 1) {
			E[1][p] = 1;
		} else {
			// E = 1 + (1-drop)*E_next
			E[1][p] = 1 + (1 - drop) * E[1][p + 1];
		}
	}

	// 2. 再解命定值未满 (Fate=0) 的情况
	for (let p = PITY_MAX - 1; p >= 0; p--) {
		const drop = getProb5Star(p);
		const winRate = getWinRate(0); // 0.375
		const loseRate = 1 - winRate;  // 0.625 (包含歪常驻和歪另一把UP)

		// 如果歪了，命定值+1，进入 Fate=1 状态，Pity归0
		// 消耗 = 歪了之后的期望 = E[1][0]
		const costWhenLose = E[1][0];

        if (p === PITY_MAX - 1) {
            E[0][p] = 1 + loseRate * costWhenLose;
        } else {
            const costNext = E[0][p + 1];
            const costWhenDrop = 1 + loseRate * costWhenLose;
            E[0][p] = drop * costWhenDrop + (1 - drop) * (1 + costNext);
        }
	}

	E_cache = E;
}

function ensureTables(): void {
	if (!E_cache) {
		calculateTables();
	}
}

export function getGenshinWeaponExpectation(args: GachaArgs): ExpectationResult {
	ensureTables();
	if (!E_cache) throw new Error('Table not initialized');

	// 参数归一化
	const pity = clampInt(args.initialState.pity, 0, PITY_MAX - 1);

	let fatePoint = clampInt(args.initialState.fatePoint, 0, 1);

    // 为了保守起见，武器池通常只看命定值是否满定轨，不考虑Pity。
	
	const targetCount = Math.max(1, Math.floor(args.targetCount));

	// 1. 第 1 把的期望
	let totalPulls = E_cache[fatePoint][pity];

	// 2. 后续目标 (2..N)
	// 每次出货定轨武器后，命定值重置为 0
	if (targetCount > 1) {
		const oneCycleExpectation = E_cache[0][0];
		totalPulls += (targetCount - 1) * oneCycleExpectation;
	}

	return { mean: totalPulls };
}