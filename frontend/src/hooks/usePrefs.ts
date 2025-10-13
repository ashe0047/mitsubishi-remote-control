import { useEffect, useState } from "react";

/* Custom Hook: LocalStorage-based Preferences */
export default function useAirConPreferences() {
	const [prefs, setPrefs] = useState({
		useFahrenheit: false,
		sleepMode: false,
	});

	// Load preferences on mount
	useEffect(() => {
		const saved = localStorage.getItem("ac-preferences");
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				setPrefs({
					useFahrenheit: parsed.useFahrenheit ?? false,
					sleepMode: parsed.sleepMode ?? false,
				});
			} catch (err) {
				console.error("Failed to parse saved preferences", err);
			}
		}
	}, []);

	// Save preferences on change
	useEffect(() => {
		localStorage.setItem("ac-preferences", JSON.stringify(prefs));
	}, [prefs]);

	return [prefs, setPrefs] as const;
}
