import { memo, useCallback } from 'react';
import { ActuatorKey, ActuatorState } from '../types';

interface Props {
	mode: 'auto' | 'manual';
	onModeChange: (mode: 'auto' | 'manual') => void;
	actuators: Record<ActuatorKey, ActuatorState>;
	onToggle: (key: ActuatorKey, next: boolean) => void;
	onAll: (next: boolean) => void;
}

interface ToggleProps {
	on: boolean;
	onClick: () => void;
	disabled?: boolean;
}

// Memoized Toggle untuk mengurangi re-render
const Toggle = memo(function Toggle({ on, onClick, disabled }: ToggleProps) {
	return (
		<div 
			className={`switch ${on ? 'on' : ''}`} 
			onClick={() => !disabled && onClick()} 
			role="switch" 
			aria-checked={on}
			style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
		>
			<div className="knob" />
		</div>
	);
});

// Memoized ActuatorItem untuk mengurangi re-render saat mode berubah
interface ActuatorItemProps {
	k: ActuatorKey;
	a: ActuatorState;
	isAuto: boolean;
	onToggle: (key: ActuatorKey, next: boolean) => void;
}

const ActuatorItem = memo(function ActuatorItem({ k, a, isAuto, onToggle }: ActuatorItemProps) {
	const statusColor = a.isOn ? 'var(--ok)' : 'var(--muted)';
	return (
		<div className="card actuator-item" style={{
			border: `1.5px solid ${a.isOn ? 'rgba(16, 185, 129, 0.3)' : 'var(--card-border)'}`,
			background: a.isOn ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
		}}>
			<div className="row" style={{ marginBottom: 12 }}>
				<div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
				<div className="spacer" />
				<div style={{ 
					fontSize: 11, 
					fontWeight: 600,
					color: statusColor,
					display: 'flex',
					alignItems: 'center',
					gap: 4
				}}>
					<span style={{
						display: 'inline-block',
						width: 6,
						height: 6,
						borderRadius: '50%',
						background: statusColor
					}}></span>
					{a.isOn ? 'ON' : 'OFF'}
				</div>
			</div>
			<div className="row" style={{ gap: 12 }}>
				<Toggle 
					on={a.isOn} 
					onClick={() => !isAuto && onToggle(k, !a.isOn)}
					disabled={isAuto}
				/>
				<div style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
					{isAuto ? 'Otomatis' : (a.isOn ? 'Aktif' : 'Nonaktif')}
				</div>
			</div>
		</div>
	);
});

const ActuatorPanel = memo(function ActuatorPanel({ mode, onModeChange, actuators, onToggle, onAll }: Props) {
	const isAuto = mode === 'auto';
	
	const handleModeChange = useCallback((newMode: 'auto' | 'manual') => {
		onModeChange(newMode);
	}, [onModeChange]);

	const handleToggle = useCallback((key: ActuatorKey, next: boolean) => {
		onToggle(key, next);
	}, [onToggle]);

	const handleAllOn = useCallback(() => {
		onAll(true);
	}, [onAll]);

	const handleAllOff = useCallback(() => {
		onAll(false);
	}, [onAll]);

	return (
		<div className="card">
			<div className="row" style={{ marginBottom: 20 }}>
				<div>
					<div className="title" style={{ fontSize: 20, margin: 0, marginBottom: 4 }}>Aktuator</div>
					<div style={{ fontSize: 12, color: 'var(--muted)' }}>
						Mode: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{isAuto ? 'Otomatis' : 'Manual'}</span>
					</div>
				</div>
				<div className="spacer" />
				<div className="row" style={{ gap: 10 }}>
					<button 
						className={`btn ${isAuto ? 'ok' : ''}`} 
						onClick={() => handleModeChange('auto')} 
						disabled={isAuto}
						style={{ minWidth: 80 }}
					>
						Otomatis
					</button>
					<button 
						className={`btn ${!isAuto ? 'ok' : ''}`} 
						onClick={() => handleModeChange('manual')} 
						disabled={!isAuto}
						style={{ minWidth: 80 }}
					>
						Manual
					</button>
				</div>
			</div>

			{!isAuto && (
				<div className="row" style={{ marginBottom: 20, gap: 10 }}>
					<button className="btn ok" onClick={handleAllOn}>
						✓ Semua ON
					</button>
					<button className="btn danger" onClick={handleAllOff}>
						✕ Semua OFF
					</button>
				</div>
			)}

			<div className="actuator-grid">
				{(['lamp', 'fan', 'pump'] as ActuatorKey[]).map((k) => (
					<ActuatorItem
						key={k}
						k={k}
						a={actuators[k]}
						isAuto={isAuto}
						onToggle={handleToggle}
					/>
				))}
			</div>
		</div>
	);
});

export default ActuatorPanel;



