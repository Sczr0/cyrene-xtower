// 星穹铁道光锥池数学期望模型
// 对应 Python 中的 HSRLightConeModel(SimpleGachaModel)

import type { ExpectationResult, GachaArgs } from '../core/types';
import type { Matrix } from '../core/matrix';
import { solveLinearSystem } from '../core/matrix';

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

function getProb5Star(pityIndex: number): number {
	const pull = pityIndex + 1;
	if (pull >= 80) return 1;
	if (pull < 66) return 0.008;
	return 0.008 + (pull - 65) * 0.08;
}

function getWinLoseProb(isGuaranteed: boolean): { win: number; lose: number } {
	if (isGuaranteed) {
		return { win: 1, lose: 0 };
	}
	// 小保底：75% 中 UP，25% 歪
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

		if (p5 < 1) {
			const nextIndex = stateToIndex(pity + 1, isG);
			A[i][nextIndex] -= 1 - p5;
		}

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

export function getHSRLightConeExpectation(args: GachaArgs): ExpectationResult {
	ensureTables();

	if (!expectationTable || subsequentExpectation == null) {
		throw new Error('HSR 光锥池期望表尚未初始化');
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

