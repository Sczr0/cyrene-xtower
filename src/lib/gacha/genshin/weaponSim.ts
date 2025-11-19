// 原神武器池蒙特卡洛模拟模型
// 对应 Python 中的 GenshinWeaponLogic(GenshinWeaponModel)

import type { DistributionResult, GachaArgs } from '../core/types';
import type { RNG } from '../core/rng';
import { computePercentiles, computeSuccessRate } from '../core/stats';

const DEFAULT_SIMULATION_COUNT = 50_000;

interface SimState {
	pity: number;
	pity4: number;
	isGuaranteed: boolean;
	isGuaranteed4: boolean;
	fatePoint: number;
}

type Collection = Record<string, number>;

const NUM_CHARS_4_STAR = 39;
const NUM_WEAPONS_4_STAR = 18;
const TOTAL_OFF_BANNER_4_STAR = NUM_CHARS_4_STAR + NUM_WEAPONS_4_STAR;

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
	return { win: 0.375, lose: 0.625 };
}

function handleFourStarPull(state: SimState, rng: RNG, collection: Collection): number {
	state.pity4 = 0;

	// 四星 UP 概率约 75%
	if (state.isGuaranteed4 || rng.next() < 0.75) {
		state.isGuaranteed4 = false;
		// 抽中 UP 四星武器，固定返还 2 星辉
		return 2;
	}

	state.isGuaranteed4 = true;

	// 歪出角色或常驻武器，约 50%
	if (rng.next() < NUM_CHARS_4_STAR / TOTAL_OFF_BANNER_4_STAR) {
		const index = Math.floor(rng.next() * NUM_CHARS_4_STAR);
		const key = `std_char_${index}`;
		const count = (collection[key] ?? 0) + 1;
		collection[key] = count;

		if (count === 1) return 0;
		if (count <= 7) return 2;
		return 5;
	}

	// 歪出四星武器，固定返还 2 星辉
	return 2;
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
			const isGuaranteedOrFateFull =
				state.isGuaranteed || state.fatePoint >= 2;
			const { win: pWin } = getWinLoseProb(isGuaranteedOrFateFull);
			const isTarget = rng.next() < pWin;

			state.pity = 0;
			state.pity4 = 0;

			// 抽到五星武器固定返还 10 星辉
			returnsThisRun += 10;

			if (isTarget) {
				// 抽中目标：重置命定值与大保底
				state.fatePoint = 0;
				state.isGuaranteed = false;
				return { pulls, returns: returnsThisRun };
			}

			// 歪了：命定值 +1，进入大保底
			state.fatePoint = Math.min(state.fatePoint + 1, 2);
			state.isGuaranteed = true;
		} else {
			const denom = p5 < 1 ? 1 - p5 : 0.99;
			const triggerFourStar = state.pity4 >= 10 || rng.next() < 0.051 / denom;
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
		isGuaranteed4: false,
		fatePoint: Math.max(0, Math.floor(args.initialState.fatePoint))
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

export function runGenshinWeaponDistribution(
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

