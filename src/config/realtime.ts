/**
 * Konfigurasi optimasi performa real-time
 */

export const REALTIME_CONFIG = {
	// Debounce sensor values untuk mengurangi update frequency
	SENSOR_DEBOUNCE_MS: 100,

	// Batch state updates dalam window ini
	STATE_BATCH_WINDOW_MS: 50,

	// Update UI setiap 1 detik untuk data realtime
	REALTIME_UPDATE_INTERVAL_MS: 1000,

	// Debounce untuk time series data
	SERIES_DEBOUNCE_MS: 200,

	// Rate limit untuk actuator commands
	ACTUATOR_RATE_LIMIT: 5, // max 5 commands per second

	// Cache data untuk mengurangi memory churn
	CACHE_TTL_MS: 30000, // 30 detik

	// Limit data points untuk performance
	MAX_SERIES_POINTS: 1440, // ~24 jam per menit

	// Polling interval untuk demo mode
	DEMO_POLL_INTERVAL_MS: 5000,

	// Firebase connection timeout
	FIREBASE_TIMEOUT_MS: 10000,

	// Enable compression untuk large payloads
	ENABLE_COMPRESSION: true,

	// Log performance metrics
	DEBUG_PERFORMANCE: false // Set ke true untuk debugging
};

export const ANIMATION_CONFIG = {
	// Disable transitions saat ada banyak updates
	ENABLE_ANIMATIONS: true,

	// Debounce animation trigger
	ANIMATION_DEBOUNCE_MS: 300,

	// Limit re-renders per second
	MAX_RENDERS_PER_SECOND: 60
};export const MEMORY_CONFIG = {
	// Max size of state history
	MAX_HISTORY_SIZE: 100,

	// Cleanup interval
	CLEANUP_INTERVAL_MS: 60000, // 1 menit

	// Aggressive cleanup threshold
	MEMORY_THRESHOLD_MB: 100
};
