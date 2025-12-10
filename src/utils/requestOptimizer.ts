/**
 * Request optimizer untuk mengurangi beban ke Firebase
 * Menggunakan debounce dan deduplication
 */

interface PendingRequest {
	id: string;
	promise: Promise<any>;
	timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest>();
const debounceTimers = new Map<string, number>();

/**
 * Deduplicate concurrent requests - hanya kirim request sekali
 */
export function deduplicateRequest<T>(
	key: string,
	fn: () => Promise<T>,
	ttl = 5000 // 5 detik
): Promise<T> {
	const existing = pendingRequests.get(key);
	
	if (existing && Date.now() - existing.timestamp < ttl) {
		return existing.promise;
	}

	const promise = fn();
	pendingRequests.set(key, {
		id: key,
		promise,
		timestamp: Date.now()
	});

	promise.finally(() => {
		// Cleanup setelah selesai
		setTimeout(() => pendingRequests.delete(key), ttl);
	});

	return promise;
}

/**
 * Batch multiple updates menjadi satu
 */
export function batchUpdates<T>(
	key: string,
	fn: () => Promise<T>,
	delay = 100
): Promise<T> {
	return new Promise((resolve, reject) => {
		if (debounceTimers.has(key)) {
			clearTimeout(debounceTimers.get(key)!);
		}

		const timer = setTimeout(async () => {
			try {
				const result = await fn();
				resolve(result);
				debounceTimers.delete(key);
			} catch (error) {
				reject(error);
				debounceTimers.delete(key);
			}
		}, delay);

		debounceTimers.set(key, timer);
	});
}

/**
 * Rate limiter untuk mencegah terlalu banyak request
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
	const requests: number[] = [];

	return {
		canMakeRequest(): boolean {
			const now = Date.now();
			// Hapus request yang sudah expired
			const validRequests = requests.filter(time => now - time < windowMs);

			if (validRequests.length < maxRequests) {
				validRequests.push(now);
				return true;
			}
			return false;
		},
		getRetryAfter(): number {
			if (requests.length === 0) return 0;
			const oldest = Math.min(...requests);
			return Math.max(0, windowMs - (Date.now() - oldest));
		}
	};
}

// Rate limiter untuk actuator commands (max 5 per second)
export const actuatorRateLimiter = createRateLimiter(5, 1000);
