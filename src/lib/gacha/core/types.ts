// 抽卡核心通用类型定义

export type GameKey = 'genshin' | 'hsr' | 'zzz';

export type PoolKey = 'character' | 'weapon' | 'lightcone';

export type Mode = 'expectation' | 'distribution';

export interface InitialState {
	pity: number;
	isGuaranteed: boolean;
	mingguangCounter: number;
	fatePoint: number;
}

export interface GachaArgs {
	game: GameKey;
	pool: PoolKey;
	mode: Mode;
	targetCount: number;
	up4C6: boolean;
	budget: number | null;
	initialState: InitialState;
}

export interface PullStats {
	mean: number;
	p25?: number;
	p50?: number;
	p75?: number;
	p90?: number;
	p95?: number;
}

export interface ExpectationResult {
	mean: number;
}

export interface DistributionResult {
	pulls: PullStats;
	successRate?: number;
	returns?: PullStats;
}

