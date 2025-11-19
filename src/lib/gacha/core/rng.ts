// 高性能随机数生成器，与 Python 版本的 _RNG 行为保持一致

export class RNG {
	private readonly chunkSize: number;

	private buffer: Float64Array;

	private index: number;

	constructor(chunkSize = 1_000_000) {
		this.chunkSize = chunkSize;
		this.buffer = this.generateChunk();
		this.index = 0;
	}

	private generateChunk(): Float64Array {
		const arr = new Float64Array(this.chunkSize);
		for (let i = 0; i < this.chunkSize; i += 1) {
			arr[i] = Math.random();
		}
		return arr;
	}

	// 获取一个 [0, 1) 区间的随机数
	next(): number {
		if (this.index >= this.chunkSize) {
			this.buffer = this.generateChunk();
			this.index = 0;
		}
		const value = this.buffer[this.index];
		this.index += 1;
		return value;
	}
}

