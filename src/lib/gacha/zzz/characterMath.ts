// 绝区零角色池数学期望模型
// Python 中 ZZZCharacterLogic 继承自 HSRCharacterModel，
// 数学期望完全复用 HSR 角色池的状态与转移矩阵。

import type { ExpectationResult, GachaArgs } from '../core/types';
import { getHSRCharacterExpectation } from '../hsr/characterMath';

export function getZZZCharacterExpectation(args: GachaArgs): ExpectationResult {
	return getHSRCharacterExpectation(args);
}

