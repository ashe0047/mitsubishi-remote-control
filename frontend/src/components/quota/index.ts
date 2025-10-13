// Lazy-loaded exports for performance optimization
import { lazy } from "react";

// Legacy Quota Management Components (existing)
export { default as QuotaStatusBadge } from "./QuotaStatusBadge";
export type { QuotaStatusBadgeProps } from "./QuotaStatusBadge";

export { default as QuotaWarningModal } from "./QuotaWarningModal";
export type { QuotaWarningModalProps } from "./QuotaWarningModal";

export { default as QuotaUsageCard } from "./QuotaUsageCard";
export type { QuotaUsageCardProps } from "./QuotaUsageCard";

export { default as QuotaAwareAirConRemote } from "./QuotaAwareAirConRemote";
export type { QuotaAwareAirConRemoteProps } from "./QuotaAwareAirConRemote";

export { default as QuotaConnectionStatus } from "./QuotaConnectionStatus";

// New comprehensive quota system components with lazy loading
export const QuotaSetupWizard = lazy(() =>
	import("./QuotaSetupWizard").then((module) => ({
		default: module.QuotaSetupWizard,
	}))
);

export const QuotaUsageTracker = lazy(() =>
	import("./QuotaUsageTracker").then((module) => ({
		default: module.QuotaUsageTracker,
	}))
);

export const QuotaOverrideRequest = lazy(() =>
	import("./QuotaOverrideRequest").then((module) => ({
		default: module.QuotaOverrideRequest,
	}))
);

export const OverrideRequestList = lazy(() =>
	import("./QuotaOverrideRequest").then((module) => ({
		default: module.OverrideRequestList,
	}))
);

export const QuotaManagementDashboard = lazy(() =>
	import("./QuotaManagementDashboard").then((module) => ({
		default: module.QuotaManagementDashboard,
	}))
);

// Phase 4 Quota Management Components (Direct exports for optimal performance)
export { default as QuotaSetupForm } from './QuotaSetupForm';
export type { QuotaSetupData, QuotaSetupFormProps } from './QuotaSetupForm';

export { default as QuotaList } from './QuotaList';
export type { QuotaData, QuotaListProps } from './QuotaList';

export { default as QuotaManagementPage } from './QuotaManagementPage';
export type {
  QuotaManagementPageProps,
  User as QuotaUser,
  Room as QuotaRoom
} from './QuotaManagementPage';

export { default as UsageDashboard } from './UsageDashboard';
export type {
  UsageData,
  UsageTrends,
  UsageDashboardProps
} from './UsageDashboard';

export { default as OverrideRequestDialog } from './OverrideRequestDialog';
export type {
  OverrideRequest as OverrideRequestData,
  QuotaInfo,
  OverrideRequestDialogProps
} from './OverrideRequestDialog';

export { default as OverrideManagement } from './OverrideManagement';
export type {
  OverrideRecord,
  OverrideStats,
  OverrideManagementProps
} from './OverrideManagement';

export { default as QuickOverrideButton } from './QuickOverrideButton';
export type { QuickOverrideButtonProps } from './QuickOverrideButton';

// Optimized version for critical path (non-lazy for performance)
export { QuotaStatusWidget } from "./QuotaStatusWidget.optimized";

// WebSocket providers and hooks (not lazy loaded as they're needed for context)
export {
	QuotaWebSocketContextProvider,
	useQuotaWebSocketContext,
	useQuotaTracking,
	useQuotaWebSocket as useQuotaWebSocketNew,
} from "@/lib/quota/quota-websocket";

// Types and interfaces
export type { QuotaUsage } from "./QuotaUsageTracker";
export type { OverrideRequest } from "./QuotaOverrideRequest";
export type {
	QuotaWebSocketMessage,
	QuotaUpdateMessage,
	OverrideRequestMessage,
	QuotaViolationAlert,
} from "@/lib/quota/quota-websocket";

// Re-export quota store hooks for convenience
export {
	useUserQuotaBalance,
	useUserViolations,
	useQuotaOverrideRequest,
	useQuotaUsagePercentage,
	useQuotaConnectionStatus,
	useQuotaStore,
} from "@/stores/quota-store";

// Re-export WebSocket hooks (legacy)
export {
	useQuotaWebSocket,
	useQuotaWebSocketConnection,
} from "@/hooks/useQuoteWebsocket";

// Preload critical components for better performance
if (typeof window !== "undefined") {
	// Preload the most commonly used components during idle time
	const preloadComponent = (importFn: () => Promise<unknown>) => {
		// Use requestIdleCallback for better performance
		if ("requestIdleCallback" in window) {
			(window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => void }).requestIdleCallback?.(
				() => {
					importFn().catch(() => {
						// Silently handle preload failures
					});
				},
				{ timeout: 5000 }
			);
		} else {
			// Fallback for browsers without requestIdleCallback
			setTimeout(() => {
				importFn().catch(() => {
					// Silently handle preload failures
				});
			}, 100);
		}
	};

	// Preload critical components after initial render
	preloadComponent(() => import("./QuotaUsageTracker"));
	preloadComponent(() => import("./QuotaOverrideRequest"));
}
