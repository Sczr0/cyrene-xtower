// 线性代数封装：当前实现为简单高斯消元，后续可替换为专门数值库

// 表示一个实数矩阵
export type Matrix = number[][];

// 求解线性方程组 A * x = b
export function solveLinearSystem(A: Matrix, b: number[]): number[] {
	const n = A.length;
	if (!n) return [];

	const m = A[0].length;
	if (m !== n) {
		throw new Error('solveLinearSystem 仅支持方阵');
	}
	if (b.length !== n) {
		throw new Error('向量 b 的长度必须与矩阵 A 维度一致');
	}

	// 拷贝一份矩阵与向量，避免修改外部数据
	const mat: Matrix = A.map((row) => row.slice());
	const rhs = b.slice();

	// 高斯消元（带简单主元选取）
	for (let i = 0; i < n; i += 1) {
		// 选主元
		let pivotRow = i;
		let pivotVal = Math.abs(mat[i][i]);
		for (let r = i + 1; r < n; r += 1) {
			const val = Math.abs(mat[r][i]);
			if (val > pivotVal) {
				pivotVal = val;
				pivotRow = r;
			}
		}

		if (pivotVal === 0) {
			throw new Error('线性方程组奇异或近似奇异，无法求解');
		}

		// 行交换
		if (pivotRow !== i) {
			const tmpRow = mat[i];
			mat[i] = mat[pivotRow];
			mat[pivotRow] = tmpRow;

			const tmpVal = rhs[i];
			rhs[i] = rhs[pivotRow];
			rhs[pivotRow] = tmpVal;
		}

		// 归一化主元行
		const pivot = mat[i][i];
		for (let c = i; c < n; c += 1) {
			mat[i][c] /= pivot;
		}
		rhs[i] /= pivot;

		// 消元
		for (let r = i + 1; r < n; r += 1) {
			const factor = mat[r][i];
			if (factor === 0) continue;
			for (let c = i; c < n; c += 1) {
				mat[r][c] -= factor * mat[i][c];
			}
			rhs[r] -= factor * rhs[i];
		}
	}

	// 回代
	const x = new Array<number>(n).fill(0);
	for (let i = n - 1; i >= 0; i -= 1) {
		let sum = rhs[i];
		for (let c = i + 1; c < n; c += 1) {
			sum -= mat[i][c] * x[c];
		}
		x[i] = sum;
	}

	return x;
}

