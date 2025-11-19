// 绝区零武器池数学期望模型
// 对应 Python 中的 ZZZWeaponLogic(HSRLightConeModel)

import type { ExpectationResult, GachaArgs } from '../core/types';
import { getHSRLightConeExpectation } from '../hsr/lightConeMath';

// 数学模型结构与 HSR 光锥池相同，只是 5 星概率曲线不同。
// 为了保持与 Python 一致，这里暂时复用 HSR 光锥池的期望实现，
// 后续如需精调可单独实现一份矩阵求解。

export function getZZZWeaponExpectation(args: GachaArgs): ExpectationResult {
	return getHSRLightConeExpectation(args);
}

