import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Root from "@/components/Root";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const APP_TITLE = "Mitsubishi Remote Control";
export const metadata: Metadata = {
	applicationName: APP_TITLE,
	title: APP_TITLE,
	description: "Remote control that works with MQTTT and Mitsubishi ACs",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: APP_TITLE,
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<Root>{children}</Root>
			</body>
		</html>
	);
}
