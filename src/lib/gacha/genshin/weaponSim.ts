// 原神武器池蒙特卡洛模拟模型

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

const NUM_CHARS_4_STAR = 44;
const NUM_WEAPONS_4_STAR = 18;
const TOTAL_OFF_BANNER_4_STAR = NUM_CHARS_4_STAR + NUM_WEAPONS_4_STAR;

// 武器池 5.0 规则：命定值上限为 1
const FATE_MAX = 1; 

function getProb5Star(pityIndex: number): number {
	const pull = pityIndex + 1;
	if (pull >= 80) return 1;
	if (pull < 64) return 0.007;
	return 0.007 + (pull - 63) * 0.07;
}

// 判定本次出金是否必中定轨
function isFateFull(fatePoint: number): boolean {
	return fatePoint >= FATE_MAX;
}

function getWinLoseProb(isFull: boolean): { win: number; lose: number } {
	if (isFull) {
		return { win: 1, lose: 0 };
	}
	// 没满：75% UP，其中定轨占 37.5%
	return { win: 0.375, lose: 0.625 };
}

function handleFourStarPull(state: SimState, rng: RNG, collection: Collection): number {
	state.pity4 = 0;

	// 4星基础规则不变：75% UP
	if (state.isGuaranteed4 || rng.next() < 0.75) {
		state.isGuaranteed4 = false;
		return 2;
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
			// 出金了！
			
			// 判定是否必中：命定值满
			// 注：这里不再单独判断 isGuaranteed，因为 5.0 规则下，
			// 只要是歪了（无论歪常驻还是歪另一把UP），都会获得命定值。
			// 命定值 1 就必中，这比“大保底”更强。
			// 所以只需要看 fatePoint 是否满。
			
			const isFull = isFateFull(state.fatePoint);
			const { win: pWin } = getWinLoseProb(isFull);
			
			// 这里的 isTarget 指的是“抽中定轨武器”
			const isTarget = rng.next() < pWin;

			state.pity = 0;
			state.pity4 = 0;
			returnsThisRun += 10; // 5星固定返还 10 星辉

			if (isTarget) {
				// 抽中目标：重置命定值
				state.fatePoint = 0;
				state.isGuaranteed = false;
				return { pulls, returns: returnsThisRun };
			}

			// 歪了：
			// 命定值 +1（如果原本是0，变成1；如果原本是1，还是1——虽然理论上1必中不会走到这里）
			state.fatePoint = Math.min(state.fatePoint + 1, FATE_MAX);
			
			// 这里的 isGuaranteed 依然可以维护一下，主要用于 UI 展示“当前是大保底”，
			state.isGuaranteed = true;
			
		} else {
			// 4星判定逻辑
			const denom = p5 < 1 ? 1 - p5 : 0.01; // 安全分母
			const p4Base = 0.06; 
			const triggerFourStar = state.pity4 >= 10 || rng.next() < (p4Base / denom);
			
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
		// 兼容逻辑：如果用户传来 fatePoint >= 1 或 isGuaranteed=true，都视为满定轨
		isGuaranteed: Boolean(args.initialState.isGuaranteed),
		isGuaranteed4: false,
		// 5.0 规则下，Fate 最大为 1
		fatePoint: Math.min(Math.max(0, Math.floor(args.initialState.fatePoint)), FATE_MAX)
	};

	// 如果用户标记了大保底，或者命定值超标，直接拉满
	if (state.isGuaranteed || state.fatePoint >= 1) {
		state.fatePoint = 1;
	}

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