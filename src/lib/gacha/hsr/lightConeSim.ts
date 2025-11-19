// 星穹铁道光锥池蒙特卡洛模拟模型
// 对应 Python 中的 HSRLightConeLogic(HSRLightConeModel)

import type { DistributionResult, GachaArgs } from '../core/types';
import type { RNG } from '../core/rng';
import { computePercentiles, computeSuccessRate } from '../core/stats';

const DEFAULT_SIMULATION_COUNT = 50_000;

interface SimState {
	pity: number;
	pity4: number;
	isGuaranteed: boolean;
	isGuaranteed4: boolean;
}

type Collection = Record<string, number>;

const NUM_CHARS_4_STAR = 22;
const NUM_LCS_4_STAR = 29;
const TOTAL_OFF_BANNER_4_STAR = NUM_CHARS_4_STAR + NUM_LCS_4_STAR;

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
	return { win: 0.75, lose: 0.25 };
}

function getFiveStarReturn(): number {
	// 5★ 光锥固定返还 40 星芒
	return 40;
}

function handleFourStarPull(state: SimState, rng: RNG, collection: Collection, up4C6: boolean): number {
	state.pity4 = 0;

	if (state.isGuaranteed4 || rng.next() < 0.75) {
		state.isGuaranteed4 = false;
		// 抽到 UP 四星光锥
		return up4C6 ? 8 : 8;
	}

	state.isGuaranteed4 = true;

	if (rng.next() < NUM_CHARS_4_STAR / TOTAL_OFF_BANNER_4_STAR) {
		const index = Math.floor(rng.next() * NUM_CHARS_4_STAR);
		const key = `std_char_${index}`;
		const count = (collection[key] ?? 0) + 1;
		collection[key] = count;

		if (count === 1) return 0;
		if (count <= 7) return 8;
		return 20;
	}

	// 常驻光锥，固定 8 星芒
	return 8;
}

function simulateOneTarget(state: SimState, rng: RNG, collection: Collection, up4C6: boolean): {
	pulls: number;
	returns: number;
} {
	let pulls = 0;
	let returnsThisRun = 0;

	while (true) {
		pulls += 1;
		state.pity += 1;
		state.pity4 += 1;

		const p5 = getProb5Star(state.pity - 1);

		if (rng.next() < p5) {
			const wasGuaranteed = state.isGuaranteed;
			const { win: pWin } = getWinLoseProb(wasGuaranteed);
			const isTarget = rng.next() < pWin;

			state.pity = 0;
			state.pity4 = 0;

			returnsThisRun += getFiveStarReturn();

			if (isTarget) {
				state.isGuaranteed = false;
				return { pulls, returns: returnsThisRun };
			}

			state.isGuaranteed = true;
		} else {
			const denom = p5 < 1 ? 1 - p5 : 0.99;
			const triggerFourStar = state.pity4 >= 10 || rng.next() < 0.066 / denom;
			if (triggerFourStar) {
				returnsThisRun += handleFourStarPull(state, rng, collection, up4C6);
			}
		}
	}
}

function simulateOneRun(args: GachaArgs, rng: RNG): { pulls: number; returns: number } {
	const state: SimState = {
		pity: Math.max(0, Math.floor(args.initialState.pity)),
		pity4: 0,
		isGuaranteed: Boolean(args.initialState.isGuaranteed),
		isGuaranteed4: false
	};

	const collection: Collection = {};
	let totalPulls = 0;
	let totalReturns = 0;
	const targetCount = Math.max(1, Math.floor(args.targetCount));

	for (let t = 0; t < targetCount; t += 1) {
		const { pulls, returns } = simulateOneTarget(state, rng, collection, args.up4C6);
		totalPulls += pulls;
		totalReturns += returns;
	}

	return { pulls: totalPulls, returns: totalReturns };
}

export function runHSRLightConeDistribution(
	args: GachaArgs,
	rng: RNG,
	simulationCount?: number
): DistributionResult {
	const count = simulationCount ?? DEFAULT_SIMULATION_COUNT;

	const pullsSamples: number[] = [];
	const returnsSamples: number[] = [];

	for (let i = 0; i < count; i += 1) {
		const { pulls, returns } = simulateOneRun(args, rng);
		pullsSamples.push(pulls);
		returnsSamples.push(returns);
	}

	const pullsStats = computePercentiles(pullsSamples);
	const result: DistributionResult = {
		pulls: pullsStats
	};

	if (args.budget != null) {
		result.successRate = computeSuccessRate(pullsSamples, args.budget);
	}

	if (returnsSamples.length) {
		result.returns = computePercentiles(returnsSamples);
	}

	return result;
}
