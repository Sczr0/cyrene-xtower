// 原神角色池数学期望模型实现
// 对应 Python 中的 GenshinCharacterLogic.get_total_expectation

import type { ExpectationResult, GachaArgs } from '../core/types';
import type { Matrix } from '../core/matrix';
import { solveLinearSystem } from '../core/matrix';

const PITY_MAX = 90;
const GUARANTEE_MAX = 2;
const MINGGUANG_MAX = 4;
const TOTAL_STATES = PITY_MAX * GUARANTEE_MAX * MINGGUANG_MAX;

let expectationTable: Float64Array | null = null;
let absorptionProbs: number[][] | null = null;

function stateToIndex(pity: number, isGuaranteed: number, mingguang: number): number {
	return pity + isGuaranteed * PITY_MAX + mingguang * PITY_MAX * GUARANTEE_MAX;
}

function clampInt(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	if (value < min) return min;
	if (value > max) return max;
	return Math.floor(value);
}

function getProb5Star(pityIndex: number): number {
	const pull = pityIndex + 1;
	if (pull >= 90) return 1;
	if (pull < 74) return 0.006;
	return 0.006 + (pull - 73) * 0.06;
}

function getWinLoseProb(isGuaranteed: boolean, mingguangCounter: number): { win: number; lose: number } {
	if (isGuaranteed || mingguangCounter >= 3) {
		return { win: 1, lose: 0 };
	}
	const pMg = 0.00018;
	const win = pMg + (1 - pMg) * 0.5;
	const lose = (1 - pMg) * 0.5;
	return { win, lose };
}

function ensureTablesCalculated(): void {
	if (!expectationTable) {
		expectationTable = solveExpectations();
	}
	if (!absorptionProbs) {
		absorptionProbs = solveAbsorptionProbabilities();
	}
}

function solveExpectations(): Float64Array {
	const n = TOTAL_STATES;
	const A: Matrix = Array.from({ length: n }, (_, i) => {
		const row = new Array<number>(n).fill(0);
		row[i] = 1;
		return row;
	});
	const b = new Array<number>(n).fill(1);

	for (let i = 0; i < n; i += 1) {
		const mg = Math.floor(i / (PITY_MAX * GUARANTEE_MAX));
		const tmp = i % (PITY_MAX * GUARANTEE_MAX);
		const isG = Math.floor(tmp / PITY_MAX);
		const pity = tmp % PITY_MAX;

		const p5 = getProb5Star(pity);

		if (p5 < 1) {
			const nextIndex = stateToIndex(pity + 1, isG, mg);
			A[i][nextIndex] -= 1 - p5;
		}

		if (p5 > 0) {
			const { lose } = getWinLoseProb(Boolean(isG), mg);
			if (lose > 0) {
				const newMg = !isG ? mg + 1 : mg;
				const clampedMg = newMg >= MINGGUANG_MAX ? MINGGUANG_MAX - 1 : newMg;
				const loseIndex = stateToIndex(0, 1, clampedMg);
				A[i][loseIndex] -= p5 * lose;
			}
		}
	}

	const solution = solveLinearSystem(A, b);
	return new Float64Array(solution);
}

function solveAbsorptionProbabilities(): number[][] {
	const n = TOTAL_STATES;
	const Q: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
	const R: number[][] = Array.from({ length: n }, () => new Array<number>(MINGGUANG_MAX).fill(0));

	for (let i = 0; i < n; i += 1) {
		const mg = Math.floor(i / (PITY_MAX * GUARANTEE_MAX));
		const tmp = i % (PITY_MAX * GUARANTEE_MAX);
		const isG = Math.floor(tmp / PITY_MAX);
		const pity = tmp % PITY_MAX;

		const p5 = getProb5Star(pity);

		if (p5 < 1) {
			const nextIndex = stateToIndex(pity + 1, isG, mg);
			Q[i][nextIndex] = 1 - p5;
		}

		if (p5 > 0) {
			const { win, lose } = getWinLoseProb(Boolean(isG), mg);
			if (lose > 0) {
				const newMg = !isG ? mg + 1 : mg;
				const clampedMg = newMg >= MINGGUANG_MAX ? MINGGUANG_MAX - 1 : newMg;
				const loseIndex = stateToIndex(0, 1, clampedMg);
				Q[i][loseIndex] = p5 * lose;
			}
			if (win > 0) {
				const finalMg = !isG ? 0 : mg;
				R[i][finalMg] = p5 * win;
			}
		}
	}

	// 计算 (I - Q)^{-1} * R ：对 R 的每一列求解线性方程组
	const A: Matrix = Array.from({ length: n }, (_, i) => {
		const row = new Array<number>(n);
		for (let j = 0; j < n; j += 1) {
			row[j] = (i === j ? 1 : 0) - Q[i][j];
		}
		return row;
	});

	const result: number[][] = Array.from({ length: n }, () => new Array<number>(MINGGUANG_MAX).fill(0));

	for (let mg = 0; mg < MINGGUANG_MAX; mg += 1) {
		const bCol = new Array<number>(n);
		for (let i = 0; i < n; i += 1) {
			bCol[i] = R[i][mg];
		}
		const solution = solveLinearSystem(A, bCol);
		for (let i = 0; i < n; i += 1) {
			result[i][mg] = solution[i];
		}
	}

	return result;
}

export function getGenshinCharacterExpectation(args: GachaArgs): ExpectationResult {
	ensureTablesCalculated();

	if (!expectationTable || !absorptionProbs) {
		throw new Error('原神角色期望表尚未初始化');
	}

	const initial = args.initialState;

	const pity = clampInt(initial.pity, 0, PITY_MAX - 1);
	const isGuaranteed = initial.isGuaranteed ? 1 : 0;
	const mingguang = clampInt(initial.mingguangCounter, 0, MINGGUANG_MAX - 1);
	const targetCount = Math.max(1, Math.floor(args.targetCount));

	const startIndex = stateToIndex(pity, isGuaranteed, mingguang);

	let totalPulls = expectationTable[startIndex];

	if (targetCount > 1) {
		let currentMgDist = absorptionProbs[startIndex].slice();

		for (let t = 2; t <= targetCount; t += 1) {
			let pullsForThisTarget = 0;
			const nextMgDist = new Array<number>(MINGGUANG_MAX).fill(0);

			for (let mg = 0; mg < MINGGUANG_MAX; mg += 1) {
				const prob = currentMgDist[mg];
				if (prob <= 1e-9) continue;

				const stateIndex = stateToIndex(0, 0, mg);
				const expFromThisMg = expectationTable[stateIndex];
				pullsForThisTarget += prob * expFromThisMg;

				const absorptionFromHere = absorptionProbs[stateIndex];
				for (let nextMg = 0; nextMg < MINGGUANG_MAX; nextMg += 1) {
					nextMgDist[nextMg] += prob * absorptionFromHere[nextMg];
				}
			}

			totalPulls += pullsForThisTarget;
			currentMgDist = nextMgDist;
		}
	}

	return { mean: totalPulls };
}

