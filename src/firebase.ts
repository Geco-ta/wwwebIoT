import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { SensorKey, ActuatorKey } from './types';

// Firebase Config dari environment variables
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
	databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

// Debounce helper untuk mengurangi frequent updates
const createDebounce = (delay: number) => {
	const timers = new Map<string, number>();
	return (key: string, callback: () => void) => {
		if (timers.has(key)) clearTimeout(timers.get(key)!);
		const timer = window.setTimeout(() => {
			callback();
			timers.delete(key);
		}, delay);
		timers.set(key, timer);
	};
};

const debounce = createDebounce(100); // 100ms debounce untuk stability

/**
 * Subscribe to current sensor readings dengan timestamp
 */
export function subscribeToSensorCurrent(
	sensorKey: SensorKey,
	onUpdate: (value: number, timestamp: number) => void,
	onError: (error: Error) => void
) {
	try {
		const sensorRef = ref(database, `sensors/${sensorKey}/current`);
		const unsubscribe = onValue(
			sensorRef,
			(snapshot) => {
				if (snapshot.exists()) {
					const data = snapshot.val() as any;
					const value = data.value ?? 0;
					const timestamp = data.timestamp ?? Date.now();
					// Gunakan debounce untuk mengurangi update frequency
					debounce(`sensor-${sensorKey}`, () => onUpdate(value, timestamp));
				}
			},
			(error: any) => onError(error as Error)
		);
		return unsubscribe;
	} catch (error) {
		onError(error as Error);
		return () => {};
	}
}

/**
 * Subscribe to sensor time series data dengan filter 12 jam terakhir
 */
export function subscribeSensorTimeSeries(
	sensorKey: SensorKey,
	onUpdate: (points: Array<{ timestamp: number; value: number }>) => void,
	onError: (error: Error) => void
) {
	try {
		const seriesRef = ref(database, `sensors/${sensorKey}/series`);
		const unsubscribe = onValue(
			seriesRef,
			(snapshot) => {
				if (snapshot.exists()) {
					const data = snapshot.val() as any;
					const allPoints = Array.isArray(data) ? data : Object.values(data || {});
					
					// Filter data dari 12 jam terakhir
					const now = Date.now();
					const twelveHoursAgo = now - 12 * 60 * 60 * 1000;
					const filteredPoints = (allPoints as Array<{ timestamp: number; value: number }>)
						.filter(p => p && p.timestamp && p.timestamp >= twelveHoursAgo)
						.sort((a, b) => a.timestamp - b.timestamp);
					
					// Hanya kirim update jika ada perubahan data
					debounce(`series-${sensorKey}`, () => {
						onUpdate(filteredPoints.length > 0 ? filteredPoints : []);
					});
				} else {
					// Jika tidak ada data di Firebase, kirim empty array
					debounce(`series-${sensorKey}`, () => {
						onUpdate([]);
					});
				}
			},
			(error: any) => onError(error as Error)
		);
		return unsubscribe;
	} catch (error) {
		onError(error as Error);
		return () => {};
	}
}

/**
 * Subscribe to actuator state dengan instant response
 */
export function subscribeActuatorState(
	actuatorKey: ActuatorKey,
	onUpdate: (isOn: boolean) => void,
	onError: (error: Error) => void
) {
	try {
		const stateRef = ref(database, `actuators/${actuatorKey}/state`);
		const unsubscribe = onValue(
			stateRef,
			(snapshot) => {
				if (snapshot.exists()) {
					const data = snapshot.val() as any;
					const isOn = data.isOn ?? false;
					// Jangan debounce actuator state - harus instant untuk responsiveness
					onUpdate(isOn);
				}
			},
			(error: any) => onError(error as Error)
		);
		return unsubscribe;
	} catch (error) {
		onError(error as Error);
		return () => {};
	}
}

/**
 * Update actuator command dengan retry logic
 */
export async function updateActuatorCommand(
	actuatorKey: ActuatorKey,
	isOn: boolean
): Promise<void> {
	try {
		const commandRef = ref(database, `actuators/${actuatorKey}/command`);
		// Update langsung untuk instant feedback di UI
		await set(commandRef, {
			isOn,
			timestamp: Date.now()
		});
	} catch (error) {
		console.error(`Error updating actuator ${actuatorKey}:`, error);
		// Retry sekali jika gagal
		try {
			const commandRef = ref(database, `actuators/${actuatorKey}/command`);
			await set(commandRef, {
				isOn,
				timestamp: Date.now()
			});
		} catch (retryError) {
			console.error(`Retry failed for actuator ${actuatorKey}:`, retryError);
			throw retryError;
		}
	}
}

/**
 * Update system mode
 */
export async function updateSystemMode(
	mode: 'auto' | 'manual'
): Promise<void> {
	try {
		const modeRef = ref(database, 'system/mode');
		// Simpan sebagai string agar ESP32 bisa baca dengan getString()
		await set(modeRef, mode);
	} catch (error) {
		console.error('Error updating system mode:', error);
		throw error;
	}
}

/**
 * Subscribe to system mode
 */
export function subscribeSystemMode(
	onUpdate: (mode: 'auto' | 'manual') => void,
	onError: (error: Error) => void
) {
	try {
		const modeRef = ref(database, 'system/mode');
		const unsubscribe = onValue(
			modeRef,
			(snapshot) => {
				if (snapshot.exists()) {
					const data = snapshot.val();
					// Mode bisa berupa string langsung atau dalam object dengan mode property
					if (typeof data === 'string') {
						onUpdate(data as 'auto' | 'manual');
					} else if (data?.mode) {
						onUpdate(data.mode as 'auto' | 'manual');
					} else {
						onUpdate('auto');
					}
				}
			},
			(error: any) => onError(error as Error)
		);
		return unsubscribe;
	} catch (error) {
		onError(error as Error);
		return () => {};
	}
}
