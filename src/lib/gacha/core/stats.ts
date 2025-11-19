// 统计工具：用于将样本转换为分布统计数据

import type { PullStats } from './types';

// 计算均值与若干分位数
export function computePercentiles(samples: number[]): PullStats {
	if (!samples.length) {
		return {
			mean: 0
		};
	}

	const sorted = [...samples].sort((a, b) => a - b);
	const n = sorted.length;

	const mean = sorted.reduce((sum, v) => sum + v, 0) / n;

	const pick = (p: number) => {
		if (n === 1) return sorted[0];
		const idx = Math.min(n - 1, Math.max(0, Math.floor((p / 100) * n)));
		return sorted[idx];
	};

	return {
		mean,
		p25: pick(25),
		p50: pick(50),
		p75: pick(75),
		p90: pick(90),
		p95: pick(95)
	};
}

// 计算在预算抽数内完成的成功率
export function computeSuccessRate(samples: number[], budget: number): number {
	if (!samples.length || budget <= 0) return 0;
	const success = samples.filter((v) => v <= budget).length;
	return (success / samples.length) * 100;
}

