import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import SensorCard from './components/SensorCard';
import TimeSeriesChart from './components/TimeSeriesChart';
import ActuatorPanel from './components/ActuatorPanel';
import ThemeToggle from './components/ThemeToggle';
import { createInitialDashboardState, advanceOneMinute } from './data';
import { ActuatorKey, DashboardState, SensorKey } from './types';
import { useTheme } from './hooks/useTheme';
import { 
	subscribeToSensorCurrent,
	subscribeSensorTimeSeries,
	subscribeActuatorState,
	updateActuatorCommand,
	updateSystemMode,
	subscribeSystemMode
} from './firebase';

const USE_FIREBASE = import.meta.env.VITE_MODE === 'firebase';

export default function App() {
	const [state, setState] = useState<DashboardState>(() => createInitialDashboardState());
	const timerRef = useRef<number | null>(null);
	const unsubscribesRef = useRef<(() => void)[]>([]);
	const { theme, toggleTheme } = useTheme();
	const stateUpdateQueueRef = useRef<Map<string, any>>(new Map());
	const batchTimerRef = useRef<number | null>(null);

	// Batch state updates untuk mengurangi re-render
	const scheduleBatchUpdate = useCallback(() => {
		if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
		batchTimerRef.current = window.setTimeout(() => {
			const updates = Object.fromEntries(stateUpdateQueueRef.current);
			if (Object.keys(updates).length > 0) {
				setState(prev => ({ ...prev, ...updates }));
				stateUpdateQueueRef.current.clear();
			}
		}, 50); // Batch updates dalam 50ms window
	}, []);

	const enqueueSensorUpdate = useCallback((key: SensorKey, value: number) => {
		stateUpdateQueueRef.current.set(`current.${key}`, { 
			...((stateUpdateQueueRef.current.get('current') as any) || {}), 
			[key]: value 
		});
		scheduleBatchUpdate();
	}, [scheduleBatchUpdate]);

	const enqueueSeriesUpdate = useCallback((key: SensorKey, points: any[]) => {
		stateUpdateQueueRef.current.set(`series.${key}`, { 
			...((stateUpdateQueueRef.current.get('series') as any) || {}), 
			[key]: points 
		});
		scheduleBatchUpdate();
	}, [scheduleBatchUpdate]);

	const enqueueActuatorUpdate = useCallback((key: ActuatorKey, isOn: boolean) => {
		const actuators = (stateUpdateQueueRef.current.get('actuators') as any) || state.actuators;
		stateUpdateQueueRef.current.set('actuators', {
			...actuators,
			[key]: { ...actuators[key], isOn }
		});
		scheduleBatchUpdate();
	}, [scheduleBatchUpdate, state.actuators]);

	// Subscribe to Firebase realtime data
	useEffect(() => {
		if (!USE_FIREBASE) {
			// Demo mode - use simulated data
			timerRef.current = window.setInterval(() => {
				setState(prev => advanceOneMinute(prev));
			}, 5_000);
			return () => {
				if (timerRef.current) window.clearInterval(timerRef.current);
				if (batchTimerRef.current) window.clearTimeout(batchTimerRef.current);
			};
		}

		// Firebase mode - subscribe to real data dengan batching
		const sensorKeys: SensorKey[] = ['light', 'airHumidity', 'soilMoisture', 'airTemp'];

		const handleError = (error: Error) => {
			console.error('Firebase subscription error:', error);
		};

		// Check data staleness setiap 1 detik - jika > 1 menit tidak update = disconnect & set 0
		const staleCheckInterval = window.setInterval(() => {
			setState(prev => {
				const now = Date.now();
				const oneMinuteAgo = now - 60 * 1000;
				let updated = { ...prev };
				let hasStaleData = false;
				let isDisconnected = true;

				(['light', 'airHumidity', 'soilMoisture', 'airTemp'] as SensorKey[]).forEach(key => {
					const lastTimestamp = prev.current[key].timestamp;
					if (lastTimestamp < oneMinuteAgo) {
						// Data lebih dari 1 menit tidak terupdate
						updated.current[key] = { value: 0, timestamp: lastTimestamp };
						hasStaleData = true;
					} else {
						// Ada data yang masih fresh = still connected
						isDisconnected = false;
					}
				});

				// Jika disconnect - set semua series jadi kosong
				if (isDisconnected && prev.connectionStatus === 'connected') {
					updated.connectionStatus = 'disconnected';
					(['light', 'airHumidity', 'soilMoisture', 'airTemp'] as SensorKey[]).forEach(key => {
						updated.series[key] = [];
					});
					hasStaleData = true;
				} else if (!isDisconnected && prev.connectionStatus === 'disconnected') {
					// Jika reconnect
					updated.connectionStatus = 'connected';
					hasStaleData = true;
				}

				return hasStaleData ? updated : prev;
			});
		}, 1000);

		// Subscribe to sensor current values
		sensorKeys.forEach(key => {
			const unsubscribe = subscribeToSensorCurrent(
				key,
				(value, timestamp) => {
					setState(prev => ({
						...prev,
						current: { ...prev.current, [key]: { value, timestamp } }
					}));
				},
				handleError
			);
			unsubscribesRef.current.push(unsubscribe);
		});

		// Subscribe to sensor time series
		sensorKeys.forEach(key => {
			const unsubscribe = subscribeSensorTimeSeries(
				key,
				(points) => {
					// Jika Firebase kosong tapi ada dummy data, keep dummy data
					// Jika ada data dari Firebase, gunakan itu
					setState(prev => ({
						...prev,
						series: {
							...prev.series,
							[key]: points.length > 0 ? points : prev.series[key]
						}
					}));
				},
				handleError
			);
			unsubscribesRef.current.push(unsubscribe);
		});

		// Subscribe to actuator states
		(['lamp', 'fan', 'pump'] as ActuatorKey[]).forEach(key => {
			const unsubscribe = subscribeActuatorState(
				key,
				(isOn) => {
					setState(prev => ({
						...prev,
						actuators: {
							...prev.actuators,
							[key]: { ...prev.actuators[key], isOn }
						}
					}));
				},
				handleError
			);
			unsubscribesRef.current.push(unsubscribe);
		});

		// Subscribe to system mode
		const modeUnsubscribe = subscribeSystemMode(
			(mode) => {
				setState(prev => ({ ...prev, mode }));
			},
			handleError
		);
		unsubscribesRef.current.push(modeUnsubscribe);

		return () => {
			unsubscribesRef.current.forEach(unsub => unsub());
			unsubscribesRef.current = [];
			if (batchTimerRef.current) window.clearTimeout(batchTimerRef.current);
			if (staleCheckInterval) window.clearInterval(staleCheckInterval);
		};
	}, []);

	const sensorOrder: SensorKey[] = ['light', 'airHumidity', 'soilMoisture', 'airTemp'];

	const chartGroups = useMemo(() => {
		return [
			{
				title: 'Grafik Realtime - Intensitas Cahaya',
				series: [{ key: 'light' as SensorKey, points: state.series.light }]
			},
			{
				title: 'Grafik Realtime - Kelembapan Udara',
				series: [{ key: 'airHumidity' as SensorKey, points: state.series.airHumidity }]
			},
			{
				title: 'Grafik Realtime - Kelembapan Tanah',
				series: [{ key: 'soilMoisture' as SensorKey, points: state.series.soilMoisture }]
			},
			{
				title: 'Grafik Realtime - Suhu Udara',
				series: [{ key: 'airTemp' as SensorKey, points: state.series.airTemp }]
			}
		];
	}, [state.series]);

	const setMode = useCallback(async (mode: 'auto' | 'manual') => {
		setState(prev => ({ ...prev, mode }));
		if (USE_FIREBASE) {
			try {
				await updateSystemMode(mode);
			} catch (error) {
				console.error('Failed to update mode:', error);
			}
		}
	}, []);

	const setActuator = useCallback(async (key: ActuatorKey, on: boolean) => {
		// Update UI instantly untuk better UX
		setState(prev => ({ ...prev, actuators: { ...prev.actuators, [key]: { ...prev.actuators[key], isOn: on } } }));
		if (USE_FIREBASE) {
			try {
				await updateActuatorCommand(key, on);
			} catch (error) {
				console.error('Failed to update actuator:', error);
				// Revert jika gagal
				setState(prev => ({ ...prev, actuators: { ...prev.actuators, [key]: { ...prev.actuators[key], isOn: !on } } }));
			}
		}
	}, []);

	const setAllActuators = useCallback(async (on: boolean) => {
		const next = { ...state.actuators };
		(['lamp', 'fan', 'pump'] as ActuatorKey[]).forEach(k => next[k] = { ...next[k], isOn: on });
		setState(prev => ({ ...prev, actuators: next }));
		
		if (USE_FIREBASE) {
			try {
				await Promise.all([
					updateActuatorCommand('lamp', on),
					updateActuatorCommand('fan', on),
					updateActuatorCommand('pump', on)
				]);
			} catch (error) {
				console.error('Failed to update actuators:', error);
			}
		}
	}, [state.actuators]);

	return (
		<>
			<ThemeToggle theme={theme} onToggle={toggleTheme} />
			<div className="container">
			<div style={{ marginBottom: 32 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
					<div className="title" style={{ margin: 0 }}>🌱 IoT Dashboard</div>
					{USE_FIREBASE && (
						<div style={{ 
							fontSize: 11, 
							fontWeight: 600, 
							color: state.connectionStatus === 'connected' ? 'var(--ok)' : 'var(--danger)',
							display: 'flex',
							alignItems: 'center',
							gap: 6,
							padding: '4px 8px',
							background: state.connectionStatus === 'connected' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
							border: state.connectionStatus === 'connected' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
							borderRadius: 6
						}}>
							<span style={{ width: 6, height: 6, background: state.connectionStatus === 'connected' ? 'var(--ok)' : 'var(--danger)', borderRadius: '50%', display: 'inline-block' }}></span>
							{state.connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
						</div>
					)}
					{!USE_FIREBASE && (
						<div style={{ 
							fontSize: 11, 
							fontWeight: 600, 
							color: 'var(--warning)',
							display: 'flex',
							alignItems: 'center',
							gap: 6,
							padding: '4px 8px',
							background: 'rgba(234, 179, 8, 0.1)',
							border: '1px solid rgba(234, 179, 8, 0.3)',
							borderRadius: 6
						}}>
							<span style={{ width: 6, height: 6, background: 'var(--warning)', borderRadius: '50%', display: 'inline-block' }}></span>
							Demo Mode
						</div>
					)}
				</div>
				<div style={{ fontSize: 13, color: 'var(--muted)' }}>
					Pemantauan real-time cahaya, kelembapan udara, kelembapan tanah, dan suhu
				</div>
			</div>

			<div className="grid" style={{ marginBottom: 24 }}>
				{sensorOrder.map((k) => (
					<SensorCard key={k} sensor={k} value={state.current[k].value} />
				))}
			</div>

			<div className="grid" style={{ marginBottom: 24 }}>
				{chartGroups.map(group => (
					<TimeSeriesChart key={group.title} title={group.title} series={group.series} />
				))}
			</div>

			<ActuatorPanel
				mode={state.mode}
				onModeChange={setMode}
				actuators={state.actuators}
				onToggle={setActuator}
				onAll={setAllActuators}
			/>

			<div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 10, fontSize: 12, color: 'var(--muted)' }}>
				{USE_FIREBASE 
					? '✅ Data real-time dari Firebase Realtime Database'
					: '📊 Demo Mode • Ubah VITE_MODE=firebase untuk production'
				}
			</div>
			</div>
		</>
	);
}

