// 绝区零角色池蒙特卡洛模拟模型
// 对应 Python 中的 ZZZCharacterLogic(HSRCharacterModel)

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
}

const NUM_STANDARD_5_STARS = 6;
const NUM_STANDARD_A_AGENTS = 12;

function getProb5Star(pityIndex: number): number {
	const pull = pityIndex + 1;
	if (pull >= 90) return 1;
	if (pull < 74) return 0.006;
	return 0.006 + (pull - 73) * 0.06;
}

function getWinLoseProb(isGuaranteed: boolean): { win: number; lose: number } {
	if (isGuaranteed) {
		return { win: 1, lose: 0 };
	}
	// 绝区零角色池 5 星为标准 50/50
	return { win: 0.5, lose: 0.5 };
}

function getFiveStarReturn(isUp: boolean, collection: Collection, rng: RNG): number {
	let key: string;
	if (isUp) {
		key = 'up_5_star';
	} else {
		const index = Math.floor(rng.next() * NUM_STANDARD_5_STARS);
		key = `std_5_star_${index}`;
	}

	const count = (collection[key] ?? 0) + 1;
	collection[key] = count;

	if (count === 1) return 0;
	if (count <= 7) return 40;
	return 100;
}

function handleFourStarPull(state: SimState, rng: RNG, collection: Collection, up4C6: boolean): number {
	state.pity4 = 0;

	if (state.isGuaranteed4 || rng.next() < 0.5) {
		state.isGuaranteed4 = false;
		return up4C6 ? 20 : 8;
	}

	state.isGuaranteed4 = true;

	const probAgent = 7.05 / (7.05 + 2.35);

	if (rng.next() < probAgent) {
		// 常驻 A 级代理人
		const index = Math.floor(rng.next() * NUM_STANDARD_A_AGENTS);
		const key = `std_char_${index}`;
		const count = (collection[key] ?? 0) + 1;
		collection[key] = count;

		if (count === 1) return 0;
		if (count <= 7) return 8;
		return 20;
	}

	// A 级音擎
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

			returnsThisRun += getFiveStarReturn(isTarget, collection, rng);

			if (isTarget) {
				// 抽中 UP，重置为小保底
				state.isGuaranteed = false;
				return { pulls, returns: returnsThisRun };
			}

			// 歪了，进入大保底
			state.isGuaranteed = true;
		} else {
			const denom = p5 < 1 ? 1 - p5 : 0.99;
			const triggerFourStar = state.pity4 >= 10 || rng.next() < 0.094 / denom;
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

export function runZZZCharacterDistribution(
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
