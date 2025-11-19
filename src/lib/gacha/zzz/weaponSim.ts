// 绝区零武器池蒙特卡洛模拟模型
// 对应 Python 中的 ZZZWeaponLogic(HSRLightConeModel)

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

const NUM_STANDARD_A_AGENTS = 12;

function getProb5Star(pityIndex: number): number {
	const pull = pityIndex + 1;
	if (pull >= 80) return 1;
	if (pull < 65) return 0.01;
	return 0.01 + (pull - 64) * 0.061875;
}

function getWinLoseProb(isGuaranteed: boolean): { win: number; lose: number } {
	if (isGuaranteed) {
		return { win: 1, lose: 0 };
	}
	return { win: 0.75, lose: 0.25 };
}

function handleFourStarPull(state: SimState, rng: RNG, collection: Collection): number {
	state.pity4 = 0;

	if (state.isGuaranteed4 || rng.next() < 0.75) {
		state.isGuaranteed4 = false;
		// 抽到 UP 或常驻四星武器，统一返还 8
		return 8;
	}

	state.isGuaranteed4 = true;

	const probWeapon = 13.125 / (13.125 + 1.875);

	if (rng.next() < probWeapon) {
		// 歪出常驻 A 级音擎
		return 8;
	}

	// 歪出常驻 A 级代理人
	const index = Math.floor(rng.next() * NUM_STANDARD_A_AGENTS);
	const key = `std_char_${index}`;
	const count = (collection[key] ?? 0) + 1;
	collection[key] = count;

	if (count === 1) return 0;
	if (count <= 7) return 8;
	return 20;
}

function simulateOneTarget(state: SimState, rng: RNG, collection: Collection): {
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

			// 抽到五星武器固定返还 40
			returnsThisRun += 40;

			if (isTarget) {
				state.isGuaranteed = false;
				return { pulls, returns: returnsThisRun };
			}

			state.isGuaranteed = true;
		} else {
			const denom = p5 < 1 ? 1 - p5 : 0.99;
			const triggerFourStar = state.pity4 >= 10 || rng.next() < 0.15 / denom;
			if (triggerFourStar) {
				returnsThisRun += handleFourStarPull(state, rng, collection);
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
		const { pulls, returns } = simulateOneTarget(state, rng, collection);
		totalPulls += pulls;
		totalReturns += returns;
	}

	return { pulls: totalPulls, returns: totalReturns };
}

export function runZZZWeaponDistribution(
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

