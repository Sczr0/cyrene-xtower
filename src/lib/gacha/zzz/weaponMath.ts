// 绝区零音擎池（武器池）数学期望模型
// 对应 Python ZZZWeaponLogic(HSRLightConeModel)，与模拟共用同一 5 星概率曲线
// ZZZ weapon banner mathematical expectation model.
// Mirrors Python ZZZWeaponLogic(HSRLightConeModel) with ZZZ-specific 5-star curve.

import type { ExpectationResult, GachaArgs } from "../core/types";
import type { Matrix } from "../core/matrix";
import { solveLinearSystem } from "../core/matrix";

// State space: pity (0-79) x isGuaranteed (0/1)
const PITY_MAX = 80;
const GUARANTEE_MAX = 2;
const TOTAL_STATES = PITY_MAX * GUARANTEE_MAX;

let expectationTable: Float64Array | null = null;
let subsequentExpectation: number | null = null;

function clampInt(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	if (value < min) return min;
	if (value > max) return max;
	return Math.floor(value);
}

function stateToIndex(pity: number, isGuaranteed: number): number {
	return pity + isGuaranteed * PITY_MAX;
}

// ZZZ weapon 5-star probability curve:
// 1% base, soft pity from pull 65, hard pity at 80.
// Matches src/lib/gacha/zzz/weaponSim.ts and Python ZZZWeaponLogic._get_prob_5_star.
function getProb5Star(pityIndex: number): number {
	const pull = pityIndex + 1;
	if (pull >= 80) return 1;
	if (pull < 65) return 0.01;
	return 0.01 + (pull - 64) * 0.061875;
}

// Small guarantee: 75% chance to hit UP, 25% off-banner; big guarantee always UP.
// Matches weaponSim.ts / ZZZWeaponLogic._get_win_lose_prob.
function getWinLoseProb(isGuaranteed: boolean): { win: number; lose: number } {
	if (isGuaranteed) {
		return { win: 1, lose: 0 };
	}
	return { win: 0.75, lose: 0.25 };
}

function ensureTables(): void {
	if (!expectationTable || subsequentExpectation == null) {
		const { table, zeroExpectation } = solveExpectationTable();
		expectationTable = table;
		subsequentExpectation = zeroExpectation;
	}
}

function solveExpectationTable(): {
	table: Float64Array;
	zeroExpectation: number;
} {
	const n = TOTAL_STATES;
	const A: Matrix = Array.from({ length: n }, (_, i) => {
		const row = new Array<number>(n).fill(0);
		row[i] = 1;
		return row;
	});
	const b = new Array<number>(n).fill(1);

	for (let i = 0; i < n; i += 1) {
		const isG = Math.floor(i / PITY_MAX);
		const pity = i % PITY_MAX;

		const p5 = getProb5Star(pity);

		// No 5-star: move to next pity state.
		if (p5 < 1) {
			const nextIndex = stateToIndex(pity + 1, isG);
			A[i][nextIndex] -= 1 - p5;
		}

		// 5-star: either stay in small guarantee (win) or move to big guarantee (lose).
		if (p5 > 0) {
			const { lose } = getWinLoseProb(Boolean(isG));
			if (lose > 0) {
				const loseIndex = stateToIndex(0, 1);
				A[i][loseIndex] -= p5 * lose;
			}
		}
	}

	const solution = solveLinearSystem(A, b);
	const table = new Float64Array(solution);

	const zeroIndex = stateToIndex(0, 0);
	const zeroExpectation = table[zeroIndex];

	return { table, zeroExpectation };
}

export function getZZZWeaponExpectation(args: GachaArgs): ExpectationResult {
	ensureTables();

	if (!expectationTable || subsequentExpectation == null) {
		throw new Error("ZZZ weapon expectation table not initialized");
	}

	const pity = clampInt(args.initialState.pity, 0, PITY_MAX - 1);
	const isGuaranteed = args.initialState.isGuaranteed ? 1 : 0;
	const targetCount = Math.max(1, Math.floor(args.targetCount));

	const startIndex = stateToIndex(pity, isGuaranteed);
	const initialExpectation = expectationTable[startIndex];

	const mean =
		initialExpectation + (targetCount - 1) * subsequentExpectation;

	return { mean };
}
