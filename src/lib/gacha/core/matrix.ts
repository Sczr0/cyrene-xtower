import { getLocaleText } from '$lib/i18n/locales';

export type Matrix = number[][];

const localeText = getLocaleText();

// Solve linear system A * x = b using Gaussian elimination with simple pivoting
export function solveLinearSystem(A: Matrix, b: number[]): number[] {
	const n = A.length;
	if (!n) return [];

	const m = A[0].length;
	if (m !== n) {
		throw new Error(localeText.engineErrors.matrixNotSquare);
	}
	if (b.length !== n) {
		throw new Error(localeText.engineErrors.matrixVectorMismatch);
	}

	// copy to avoid mutating inputs
	const mat: Matrix = A.map((row) => row.slice());
	const rhs = b.slice();

	// forward elimination with partial pivoting
	for (let i = 0; i < n; i += 1) {
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
			throw new Error(localeText.engineErrors.matrixSingular);
		}

		if (pivotRow !== i) {
			const tmpRow = mat[i];
			mat[i] = mat[pivotRow];
			mat[pivotRow] = tmpRow;

			const tmpVal = rhs[i];
			rhs[i] = rhs[pivotRow];
			rhs[pivotRow] = tmpVal;
		}

		const pivot = mat[i][i];
		for (let c = i; c < n; c += 1) {
			mat[i][c] /= pivot;
		}
		rhs[i] /= pivot;

		for (let r = i + 1; r < n; r += 1) {
			const factor = mat[r][i];
			if (factor === 0) continue;
			for (let c = i; c < n; c += 1) {
				mat[r][c] -= factor * mat[i][c];
			}
			rhs[r] -= factor * rhs[i];
		}
	}

	// back substitution
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
