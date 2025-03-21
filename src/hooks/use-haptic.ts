/* Custom Hook: Haptic Feedback */
export function useHaptic(isMobile: boolean) {
	return (duration: number) => {
		if (navigator.vibrate && isMobile) {
			navigator.vibrate(duration);
		}
	};
}
