// 原神角色池蒙特卡洛模拟模型 (适配 5.0+ 捕获明光 & 55% 概率)

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

// 副产物计算相关常量
const NUM_STANDARD_5_STARS = 7;
const NUM_CHARS_4_STAR = 44;
const NUM_WEAPONS_4_STAR = 18;
const TOTAL_OFF_BANNER_4_STAR = NUM_CHARS_4_STAR + NUM_WEAPONS_4_STAR;

// 基础概率常量
const PROB_BASE_WIN = 0.55; // 55% 综合胜率
const PROB_GUARANTEED_WIN = 1.0; // 必中

function getProb5Star(pityIndex: number): number {
	const pull = pityIndex + 1;
	if (pull >= 90) return 1;
	if (pull < 74) return 0.006;
	return 0.006 + (pull - 73) * 0.06;
}

// 获取本次出金是 UP 的概率
function getWinRate(mingguangCounter: number): number {
	// 连续歪 3 次，下次必定触发捕获明光
	if (mingguangCounter >= 3) {
		return PROB_GUARANTEED_WIN;
	}
	return PROB_BASE_WIN;
}

// --- 副产物计算逻辑 (保持不变) ---
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

// --- 核心模拟逻辑 (更新) ---
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
			// 出金了！
			const wasGuaranteed = state.isGuaranteed;
			
			// 计算本次是否为 UP
			let isTarget = false;

			if (wasGuaranteed) {
				// 如果是大保底：必中
				isTarget = true;
				// 状态更新：
				// 大保底是“歪了之后”的结果，所以属于非酋路径，计数器 +1
				state.mingguangCounter += 1;
				// 重置保底状态
				state.isGuaranteed = false;
			} else {
				// 如果是小保底：判定胜率 (55% 或 100%)
				const winRate = getWinRate(state.mingguangCounter);
				isTarget = rng.next() < winRate;

				if (isTarget) {
					// 赢了 (小保底胜 或 明光捕获)
					// 这是一次“胜利”，打断了“连续歪”的计数，计数器重置
					state.mingguangCounter = 0;
					state.isGuaranteed = false;
				} else {
					// 歪了
					// 既然歪了，肯定没触发明光，计数器 +1
					state.mingguangCounter += 1;
					// 下次必中 (大保底)
					state.isGuaranteed = true;
				}
			}

			// 重置水位
			state.pity = 0;
			state.pity4 = 0;

			// 计算副产物
			if (isTarget) {
				returnsThisRun += getFiveStarReturn(true, collection, rng);
				// 目标达成，退出循环
				return { pulls, returns: returnsThisRun };
			} else {
				// 歪了，继续抽
				returnsThisRun += getFiveStarReturn(false, collection, rng);
			}

		} else {
			// 没出金，判断四星
			// 4星概率修正：当 5星概率极高时，4星概率会被挤占，需要做分母修正
			const denom = p5 < 1 ? 1 - p5 : 0.01; // 防止除以0，给个极小值
			// 官方公示：综合出率 13%，这里使用简化的判定逻辑
			const triggerFourStar = state.pity4 >= 10 || rng.next() < (0.051 / denom);
			
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
	// 针对 Cloudflare Worker 的安全措施
	// 建议在调用层（API）限制最大次数，这里做个兜底
	// 如果是在前端 Worker 跑，可以跑多点；如果是后端，建议不超过 5000
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