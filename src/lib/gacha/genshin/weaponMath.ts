// Genshin weapon banner expectation model (math)

import type { ExpectationResult, GachaArgs } from '../core/types';
import type { Matrix } from '../core/matrix';
import { solveLinearSystem } from '../core/matrix';

const PITY_MAX = 80;
const FATE_MAX = 3;
const GUARANTEE_MAX = 2;
const TOTAL_STATES = PITY_MAX * FATE_MAX * GUARANTEE_MAX;

let expectationTable: Float64Array | null = null;
let subsequentExpectation: number | null = null;

function clampInt(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	if (value < min) return min;
	if (value > max) return max;
	return Math.floor(value);
}

function stateToIndex(pity: number, fatePoint: number, isGuaranteed: boolean): number {
	const fate = clampInt(fatePoint, 0, FATE_MAX - 1);
	const guaranteeFlag = isGuaranteed ? 1 : 0;
	return pity + fate * PITY_MAX + guaranteeFlag * PITY_MAX * FATE_MAX;
}

function getProb5Star(pityIndex: number): number {
	const pull = pityIndex + 1;
	if (pull >= 80) return 1;
	if (pull < 64) return 0.007;
	return 0.007 + (pull - 63) * 0.07;
}

function getWinLoseProb(isGuaranteedOrFateFull: boolean): { win: number; lose: number } {
	if (isGuaranteedOrFateFull) {
		return { win: 1, lose: 0 };
	}
	// Small guarantee: 37.5% hit UP, 62.5% lose
	return { win: 0.375, lose: 0.625 };
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
		const guaranteed = Math.floor(i / (PITY_MAX * FATE_MAX));
		const tmp = i % (PITY_MAX * FATE_MAX);
		const fate = Math.floor(tmp / PITY_MAX);
		const pity = tmp % PITY_MAX;

		const p5 = getProb5Star(pity);
		const isGuaranteedOrFateFull = Boolean(guaranteed) || fate >= 2;

		if (p5 < 1) {
			const nextIndex = stateToIndex(pity + 1, fate, Boolean(guaranteed));
			A[i][nextIndex] -= 1 - p5;
		}

		if (p5 > 0) {
			const { lose } = getWinLoseProb(isGuaranteedOrFateFull);
			if (lose > 0) {
				const nextFate = Math.min(fate + 1, FATE_MAX - 1);
				const loseIndex = stateToIndex(0, nextFate, true);
				A[i][loseIndex] -= p5 * lose;
			}
		}
	}

	const solution = solveLinearSystem(A, b);
	const table = new Float64Array(solution);

	const zeroIndex = stateToIndex(0, 0, false);
	const zeroExpectation = table[zeroIndex];

	return { table, zeroExpectation };
}

export function getGenshinWeaponExpectation(args: GachaArgs): ExpectationResult {
	ensureTables();

	if (!expectationTable || subsequentExpectation == null) {
		throw new Error('Genshin weapon expectation table is not initialized');
	}

	const pity = clampInt(args.initialState.pity, 0, PITY_MAX - 1);
	const fatePoint = clampInt(args.initialState.fatePoint, 0, FATE_MAX - 1);
	const isGuaranteed = Boolean(args.initialState.isGuaranteed);
	const targetCount = Math.max(1, Math.floor(args.targetCount));

	const startIndex = stateToIndex(pity, fatePoint, isGuaranteed);
	const initialExpectation = expectationTable[startIndex];

	const mean =
		initialExpectation + (targetCount - 1) * subsequentExpectation;

	return { mean };
}

