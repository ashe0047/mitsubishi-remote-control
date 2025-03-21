"use client";
import { ThemeProvider } from "next-themes";
import { PropsWithChildren, useEffect, useState } from "react";

function Root({ children }: PropsWithChildren) {
	const [mounted, setMounted] = useState(false);
	// Handle theme mounting
	useEffect(() => {
		setMounted(true);
	}, []);
	return (
		mounted && (
			<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
				{children}
			</ThemeProvider>
		)
	);
}

export default Root;
