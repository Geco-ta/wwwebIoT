import { memo, useCallback } from 'react';

interface Props {
	theme: 'dark' | 'light';
	onToggle: () => void;
}

const ThemeToggle = memo(function ThemeToggle({ theme, onToggle }: Props) {
	const handleClick = useCallback(() => {
		onToggle();
	}, [onToggle]);

	return (
		<button
			className="theme-toggle"
			onClick={handleClick}
			aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
			title={`${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
		>
			{theme === 'dark' ? '☀️' : '🌙'}
		</button>
	);
});

export default ThemeToggle;
