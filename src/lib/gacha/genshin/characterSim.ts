// 原神角色池蒙特卡洛模拟模型实现
// 对应 Python 中的 GenshinCharacterLogic.get_one_target_pulls_sim

import type { DistributionResult, GachaArgs } from '../core/types';
import type { RNG } from '../core/rng';
import { computePercentiles, computeSuccessRate } from '../core/stats';

const DEFAULT_SIMULATION_COUNT = 100_000;

type Collection = Record<string, number>;

interface SimState {
	pity: number;
	pity4: number;
	isGuaranteed: boolean;
	isGuaranteed4: boolean;
	mingguangCounter: number;
}

const NUM_STANDARD_5_STARS = 7;
const NUM_CHARS_4_STAR = 39;
const NUM_WEAPONS_4_STAR = 18;
const TOTAL_OFF_BANNER_4_STAR = NUM_CHARS_4_STAR + NUM_WEAPONS_4_STAR;

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

function getFiveStarReturn(isUp: boolean, collection: Collection, rng: RNG): number {
	if (isUp) {
		const count = (collection.up_5_star ?? 0) + 1;
		collection.up_5_star = count;
		return count <= 7 ? 10 : 25;
	}

	const index = Math.floor(rng.next() * NUM_STANDARD_5_STARS);
	const key = `std_5_star_${index}`;
	const count = (collection[key] ?? 0) + 1;
	collection[key] = count;

	if (count === 1) return 0;
	if (count <= 7) return 10;
	return 25;
}

function handleFourStarPull(state: SimState, rng: RNG, collection: Collection, up4C6: boolean): number {
	state.pity4 = 0;

	if (state.isGuaranteed4 || rng.next() < 0.5) {
		state.isGuaranteed4 = false;
		return up4C6 ? 5 : 2;
	}

	state.isGuaranteed4 = true;
	if (rng.next() < NUM_CHARS_4_STAR / TOTAL_OFF_BANNER_4_STAR) {
		const index = Math.floor(rng.next() * NUM_CHARS_4_STAR);
		const key = `std_char_${index}`;
		const count = (collection[key] ?? 0) + 1;
		collection[key] = count;

		if (count === 1) return 0;
		if (count <= 7) return 2;
		return 5;
	}

	return 2;
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
			const { win: pWin } = getWinLoseProb(wasGuaranteed, state.mingguangCounter);
			const isTarget = rng.next() < pWin;

			state.pity = 0;
			state.pity4 = 0;

			if (isTarget) {
				returnsThisRun += getFiveStarReturn(true, collection, rng);
				state.isGuaranteed = false;
				if (!wasGuaranteed) {
					state.mingguangCounter = 0;
				}
				return { pulls, returns: returnsThisRun };
			}

			returnsThisRun += getFiveStarReturn(false, collection, rng);
			state.pity = 0;
			state.isGuaranteed = true;
			if (!wasGuaranteed) {
				state.mingguangCounter += 1;
			}
		} else {
			const denom = p5 < 1 ? 1 - p5 : 0.99;
			const triggerFourStar = state.pity4 >= 10 || rng.next() < 0.051 / denom;
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
		isGuaranteed4: false,
		mingguangCounter: Math.max(0, Math.floor(args.initialState.mingguangCounter))
	};

	const collection: Collection = { up_5_star: 0 };
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

export function runGenshinCharacterDistribution(
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
