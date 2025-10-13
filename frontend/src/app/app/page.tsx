"use client";

import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { RequireAuth } from "@/components/providers/AuthProvider";
import { QuotaWebSocketContextProvider } from "@/lib/quota/quota-websocket";
import { useAuthStore } from "@/stores/auth-store";

/**
 * App Home Page - Dashboard Overview
 *
 * Shows an overview of all rooms and system stats.
 * Does not require ApiAirconProvider as it displays aggregate data,
 * not real-time data from a specific room's WebSocket connection.
 */
export default function AppHomePage() {
	return (
		<RequireAuth>
			<HomeContent />
		</RequireAuth>
	);
}

function HomeContent() {
	const user = useAuthStore((state) => state.user);

	const content = (
		<div className="h-full">
			<DashboardOverview />
		</div>
	);

	// Wrap with QuotaWebSocketProvider if user is authenticated
	if (user) {
		return (
			<QuotaWebSocketContextProvider familyMemberId={user.id}>
				{content}
			</QuotaWebSocketContextProvider>
		);
	}

	return content;
}
