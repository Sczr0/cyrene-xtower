// 抽卡计算统一入口：后续可以替代 Python 实现

import type {
	DistributionResult,
	ExpectationResult,
	GachaArgs
} from './core/types';
import { RNG } from './core/rng';
import { getGenshinCharacterExpectation } from './genshin/characterMath';
import { runGenshinCharacterDistribution } from './genshin/characterSim';
import { getGenshinWeaponExpectation } from './genshin/weaponMath';
import { runGenshinWeaponDistribution } from './genshin/weaponSim';
import { getHSRCharacterExpectation } from './hsr/characterMath';
import { runHSRCharacterDistribution } from './hsr/characterSim';
import { getHSRLightConeExpectation } from './hsr/lightConeMath';
import { runHSRLightConeDistribution } from './hsr/lightConeSim';
import { getZZZCharacterExpectation } from './zzz/characterMath';
import { runZZZCharacterDistribution } from './zzz/characterSim';
import { getZZZWeaponExpectation } from './zzz/weaponMath';
import { runZZZWeaponDistribution } from './zzz/weaponSim';

export function runExpectation(args: GachaArgs): ExpectationResult {
	const key = `${args.game}-${args.pool}` as const;

	switch (key) {
		case 'genshin-character':
			return getGenshinCharacterExpectation(args);
		case 'genshin-weapon':
			return getGenshinWeaponExpectation(args);
		case 'hsr-character':
			return getHSRCharacterExpectation(args);
		case 'hsr-lightcone':
			return getHSRLightConeExpectation(args);
		case 'zzz-character':
			return getZZZCharacterExpectation(args);
		case 'zzz-weapon':
			return getZZZWeaponExpectation(args);
		default:
			throw new Error(`不支持的游戏与卡池组合: ${key}`);
	}
}

export function runDistribution(
	args: GachaArgs,
	simulationCount?: number
): DistributionResult {
	const key = `${args.game}-${args.pool}` as const;
	const rng = new RNG();

	switch (key) {
		case 'genshin-character':
			return runGenshinCharacterDistribution(args, rng, simulationCount);
		case 'genshin-weapon':
			return runGenshinWeaponDistribution(args, rng, simulationCount);
		case 'hsr-character':
			return runHSRCharacterDistribution(args, rng, simulationCount);
		case 'hsr-lightcone':
			return runHSRLightConeDistribution(args, rng, simulationCount);
		case 'zzz-character':
			return runZZZCharacterDistribution(args, rng, simulationCount);
		case 'zzz-weapon':
			return runZZZWeaponDistribution(args, rng, simulationCount);
		default:
			throw new Error(`不支持的游戏与卡池组合: ${key}`);
	}
}

