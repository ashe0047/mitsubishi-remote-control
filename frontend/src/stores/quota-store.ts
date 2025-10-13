import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";

// Types for quota management
export interface QuotaBalance {
	quotaId: string;
	userId: string;
	roomId: string;

	// Time-based quotas
	totalSeconds?: number;
	usedSeconds?: number;
	remainingSeconds?: number;

	// Usage count quotas
	totalUsageCount?: number;
	usedUsageCount?: number;
	remainingUsageCount?: number;

	// Energy-based quotas (kWh)
	totalEnergyKwh?: number;
	usedEnergyKwh?: number;
	remainingEnergyKwh?: number;

	// Cost-based quotas
	totalCostAmount?: number;
	usedCostAmount?: number;
	remainingCostAmount?: number;

	// Configuration
	warningThreshold: number;
	lastUpdated: string;
	resetTime?: string;
	isActive: boolean;
	isExceeded?: boolean;
	hasOverride: boolean;
}

export interface QuotaViolation {
	id: string;
	userId: string;
	roomId: string;
	type: "WARNING" | "EXCEEDED" | "BLOCKED";
	message: string;
	timestamp: string;
	overrideRequested?: boolean;
	overrideGranted?: boolean;
	overrideBy?: string;
	overrideAt?: string;
}

export interface QuotaOverride {
	userId: string;
	roomId: string;
	type: "ADD_TIME" | "UNLOCK_DAY" | "EMERGENCY_OVERRIDE";
	additionalSeconds?: number;
	reason?: string;
	grantedBy: string;
	grantedAt: string;
	expiresAt?: string;
}

export interface UsageSummary {
	userId: string;
	roomId: string;
	date: string;
	totalDurationSeconds: number;
	sessionCount: number;
	avgSessionDurationSeconds: number;
	energyUsedKwh?: number;
	costIncurred?: number;
}

// Store State Interface
interface QuotaState {
	// Current quota balances per user/room
	balances: Record<string, Record<string, QuotaBalance>>;

	// Active violations and warnings
	violations: QuotaViolation[];

	// Override states and requests
	overrides: Record<string, QuotaOverride>;

	// Usage summaries for analytics
	usageSummaries: Record<string, UsageSummary[]>;

	// Loading states
	isLoadingBalances: boolean;
	isLoadingUsage: boolean;
	isRequestingOverride: boolean;

	// Error handling
	error: string | null;
	lastError?: string;

	// Connection status
	isConnected: boolean;
	lastSyncTime?: number;

	// Actions for quota balance management
	updateBalance: (
		userId: string,
		roomId: string,
		balance: QuotaBalance
	) => void;
	setBalances: (
		userId: string,
		balances: Record<string, QuotaBalance>
	) => void;
	clearBalance: (userId: string, roomId: string) => void;

	// Actions for violations
	addViolation: (violation: QuotaViolation) => void;
	clearViolation: (violationId: string) => void;
	clearAllViolations: (userId: string) => void;

	// Actions for overrides
	requestOverride: (
		userId: string,
		roomId: string,
		type: QuotaOverride["type"],
		additionalSeconds?: number,
		reason?: string
	) => Promise<void>;
	grantOverride: (
		userId: string,
		roomId: string,
		override: Omit<QuotaOverride, "userId" | "roomId">
	) => void;
	clearOverride: (userId: string, roomId: string) => void;

	// Actions for usage summaries
	updateUsageSummary: (userId: string, summary: UsageSummary) => void;
	loadUsageSummaries: (
		userId: string,
		startDate: string,
		endDate: string
	) => Promise<void>;

	// Actions for loading states and errors
	setLoading: (
		loadingType: "balances" | "usage" | "override",
		loading: boolean
	) => void;
	setError: (error: string | null) => void;
	setConnected: (connected: boolean) => void;

	// Actions for loading data from API
	loadUserQuotaBalance: (userId: string, roomId: string) => Promise<void>;
	refreshAllBalances: (userId: string) => Promise<void>;

	// Selectors for easy data access
	getBalance: (userId: string, roomId: string) => QuotaBalance | null;
	hasActiveViolation: (userId: string, roomId: string) => boolean;
	getViolationsForUser: (userId: string) => QuotaViolation[];
	hasActiveOverride: (userId: string, roomId: string) => boolean;
	getMaxUsagePercentage: (userId: string, roomId: string) => number;

	// Quota prediction for optimistic UI
	predictQuotaImpact: (
		userId: string,
		roomId: string,
		estimatedUsage: number
	) => QuotaBalance | null;
	wouldExceedQuota: (
		userId: string,
		roomId: string,
		estimatedUsage: number
	) => boolean;

	// Utility methods
	isQuotaAtWarningLevel: (userId: string, roomId: string) => boolean;
	getFormattedRemainingTime: (userId: string, roomId: string) => string;
	getUsagePercentage: (userId: string, roomId: string) => number;
}

// Helper function to calculate usage percentage
const calculateUsagePercentage = (balance: QuotaBalance): number => {
	let maxPercentage = 0;

	// Time-based percentage
	if (balance.totalSeconds && balance.usedSeconds !== undefined) {
		const timePercent = (balance.usedSeconds / balance.totalSeconds) * 100;
		maxPercentage = Math.max(maxPercentage, timePercent);
	}

	// Usage count percentage
	if (balance.totalUsageCount && balance.usedUsageCount !== undefined) {
		const countPercent =
			(balance.usedUsageCount / balance.totalUsageCount) * 100;
		maxPercentage = Math.max(maxPercentage, countPercent);
	}

	// Energy percentage
	if (balance.totalEnergyKwh && balance.usedEnergyKwh !== undefined) {
		const energyPercent =
			(balance.usedEnergyKwh / balance.totalEnergyKwh) * 100;
		maxPercentage = Math.max(maxPercentage, energyPercent);
	}

	// Cost percentage
	if (balance.totalCostAmount && balance.usedCostAmount !== undefined) {
		const costPercent =
			(balance.usedCostAmount / balance.totalCostAmount) * 100;
		maxPercentage = Math.max(maxPercentage, costPercent);
	}

	return Math.min(maxPercentage, 100); // Cap at 100%
};

// Helper function to format remaining time
const formatRemainingTime = (seconds: number): string => {
	if (seconds <= 0) return "0m";

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else {
		return `${minutes}m`;
	}
};

// Create store with middleware
export const useQuotaStore = create<QuotaState>()(
	subscribeWithSelector(
		immer((set, get) => ({
			// Initial state
			balances: {},
			violations: [],
			overrides: {},
			usageSummaries: {},
			isLoadingBalances: false,
			isLoadingUsage: false,
			isRequestingOverride: false,
			error: null,
			isConnected: false,

			// Balance management actions
			updateBalance: (userId, roomId, balance) => {
				set((state) => {
					if (!state.balances[userId]) {
						state.balances[userId] = {};
					}
					state.balances[userId][roomId] = balance;
					state.lastSyncTime = Date.now();
				});
			},

			setBalances: (userId, balances) => {
				set((state) => {
					state.balances[userId] = balances;
					state.lastSyncTime = Date.now();
				});
			},

			clearBalance: (userId, roomId) => {
				set((state) => {
					if (state.balances[userId]) {
						delete state.balances[userId][roomId];
					}
				});
			},

			// Violation management actions
			addViolation: (violation) => {
				set((state) => {
					// Remove any existing violation for the same user/room
					state.violations = state.violations.filter(
						(v: QuotaViolation) =>
							!(
								v.userId === violation.userId &&
								v.roomId === violation.roomId
							)
					);
					state.violations.push(violation);
				});
			},

			clearViolation: (violationId) => {
				set((state) => {
					state.violations = state.violations.filter(
						(v: QuotaViolation) => v.id !== violationId
					);
				});
			},

			clearAllViolations: (userId) => {
				set((state) => {
					state.violations = state.violations.filter(
						(v: QuotaViolation) => v.userId !== userId
					);
				});
			},

			// Override management actions
			requestOverride: async (
				userId,
				roomId,
				type,
				additionalSeconds,
				reason
			) => {
				set((state) => {
					state.isRequestingOverride = true;
					state.error = null;
				});

				try {
					// Import quota API client dynamically to avoid circular dependency
					const { quotaApiClient } = await import(
						"@/lib/api/quota-client"
					);

					// First get user's quota to find the quota ID
					const balance = get().getBalance(userId, roomId);
					if (!balance || !balance.quotaId) {
						throw new Error(
							"No active quota found for override request"
						);
					}

					const result = await quotaApiClient.requestOverride(
						balance.quotaId,
						{
							type,
							additionalSeconds,
							reason: reason || "Override request",
						}
					);

					const override: QuotaOverride = {
						userId,
						roomId,
						type,
						additionalSeconds,
						reason: reason || "Override request",
						grantedBy: result.quotaId, // Will be updated with actual granter info
						grantedAt: result.grantedAt,
					};

					set((state) => {
						const key = `${userId}:${roomId}`;
						state.overrides[key] = override;
						state.isRequestingOverride = false;

						// Clear any related violations
						state.violations = state.violations.filter(
							(v: QuotaViolation) =>
								!(v.userId === userId && v.roomId === roomId)
						);
					});
				} catch (error) {
					set((state) => {
						state.error =
							error instanceof Error
								? error.message
								: "Override request failed";
						state.lastError = state.error;
						state.isRequestingOverride = false;
					});
					throw error;
				}
			},

			grantOverride: (userId, roomId, override) => {
				set((state) => {
					const key = `${userId}:${roomId}`;
					state.overrides[key] = {
						userId,
						roomId,
						...override,
					};

					// Clear any related violations
					state.violations = state.violations.filter(
						(v: QuotaViolation) =>
							!(v.userId === userId && v.roomId === roomId)
					);
				});
			},

			clearOverride: (userId, roomId) => {
				set((state) => {
					const key = `${userId}:${roomId}`;
					delete state.overrides[key];
				});
			},

			// Usage summary actions
			updateUsageSummary: (userId, summary) => {
				set((state) => {
					if (!state.usageSummaries[userId]) {
						state.usageSummaries[userId] = [];
					}

					const existingIndex = state.usageSummaries[
						userId
					].findIndex(
						(s: UsageSummary) =>
							s.roomId === summary.roomId &&
							s.date === summary.date
					);

					if (existingIndex >= 0) {
						state.usageSummaries[userId][existingIndex] = summary;
					} else {
						state.usageSummaries[userId].push(summary);
					}
				});
			},

			loadUsageSummaries: async (userId, startDate, endDate) => {
				set((state) => {
					state.isLoadingUsage = true;
					state.error = null;
				});

				try {
					// Import quota API client dynamically to avoid circular dependency
					const { quotaApiClient } = await import(
						"@/lib/api/quota-client"
					);

					const summaries = await quotaApiClient.getUsageSummaries(
						userId,
						startDate,
						endDate
					);

					set((state) => {
						state.usageSummaries[userId] = summaries;
						state.isLoadingUsage = false;
					});
				} catch (error) {
					set((state) => {
						state.error =
							error instanceof Error
								? error.message
								: "Failed to load usage data";
						state.lastError = state.error;
						state.isLoadingUsage = false;
					});
					throw error;
				}
			},

			// Utility actions
			setLoading: (loadingType, loading) => {
				set((state) => {
					switch (loadingType) {
						case "balances":
							state.isLoadingBalances = loading;
							break;
						case "usage":
							state.isLoadingUsage = loading;
							break;
						case "override":
							state.isRequestingOverride = loading;
							break;
					}
				});
			},

			setError: (error) => {
				set((state) => {
					state.error = error;
					if (error) {
						state.lastError = error;
					}
				});
			},

			setConnected: (connected) => {
				set((state) => {
					state.isConnected = connected;
					if (connected) {
						state.lastSyncTime = Date.now();
					}
				});
			},

			// API data loading actions
			loadUserQuotaBalance: async (userId, roomId) => {
				set((state) => {
					state.isLoadingBalances = true;
					state.error = null;
				});

				try {
					// Import quota API client dynamically to avoid circular dependency
					const { quotaApiClient } = await import(
						"@/lib/api/quota-client"
					);

					const balance = await quotaApiClient.getQuotaBalance(
						userId,
						roomId
					);

					set((state) => {
						if (!state.balances[userId]) {
							state.balances[userId] = {};
						}
						state.balances[userId][roomId] = balance;
						state.isLoadingBalances = false;
						state.lastSyncTime = Date.now();
					});
				} catch (error) {
					set((state) => {
						state.error =
							error instanceof Error
								? error.message
								: "Failed to load quota balance";
						state.lastError = state.error;
						state.isLoadingBalances = false;
					});
					throw error;
				}
			},

			refreshAllBalances: async (userId) => {
				set((state) => {
					state.isLoadingBalances = true;
					state.error = null;
				});

				try {
					// Import quota API client dynamically to avoid circular dependency
					const { quotaApiClient } = await import(
						"@/lib/api/quota-client"
					);

					const quotas = await quotaApiClient.getAllUserQuotas(
						userId
					);
					const balances: Record<string, QuotaBalance> = {};

					// Load balance for each room where user has quotas
					for (const quota of quotas) {
						try {
							const balance =
								await quotaApiClient.getQuotaBalance(
									userId,
									quota.targetId
								);
							balances[quota.targetId] = balance;
						} catch (error) {
							console.warn(
								`Failed to load balance for room ${quota.targetId}:`,
								error
							);
						}
					}

					set((state) => {
						state.balances[userId] = balances;
						state.isLoadingBalances = false;
						state.lastSyncTime = Date.now();
					});
				} catch (error) {
					set((state) => {
						state.error =
							error instanceof Error
								? error.message
								: "Failed to refresh balances";
						state.lastError = state.error;
						state.isLoadingBalances = false;
					});
					throw error;
				}
			},

			// Selectors
			getBalance: (userId, roomId) => {
				const state = get();
				return state.balances[userId]?.[roomId] || null;
			},

			hasActiveViolation: (userId, roomId) => {
				const state = get();
				return state.violations.some(
					(v) => v.userId === userId && v.roomId === roomId
				);
			},

			getViolationsForUser: (userId) => {
				const state = get();
				return state.violations.filter((v) => v.userId === userId);
			},

			hasActiveOverride: (userId, roomId) => {
				const state = get();
				const key = `${userId}:${roomId}`;
				const override = state.overrides[key];

				if (!override) return false;

				// Check if override has expired
				if (override.expiresAt) {
					const expiryTime = new Date(override.expiresAt).getTime();
					if (Date.now() > expiryTime) {
						// Clear expired override
						delete state.overrides[key];
						return false;
					}
				}

				return true;
			},

			getMaxUsagePercentage: (userId, roomId) => {
				const state = get();
				const balance = state.balances[userId]?.[roomId];
				if (!balance) return 0;

				return calculateUsagePercentage(balance);
			},

			// Optimistic quota prediction for immediate UI feedback
			predictQuotaImpact: (userId, roomId, estimatedUsage) => {
				const state = get();
				const currentBalance = state.balances[userId]?.[roomId];

				if (!currentBalance) return null;

				// Create a predicted balance based on estimated usage
				return {
					...currentBalance,
					usedSeconds:
						(currentBalance.usedSeconds || 0) + estimatedUsage,
					remainingSeconds: Math.max(
						0,
						(currentBalance.remainingSeconds || 0) - estimatedUsage
					),
					lastUpdated: new Date().toISOString(),
				};
			},

			wouldExceedQuota: (userId, roomId, estimatedUsage) => {
				const prediction = get().predictQuotaImpact(
					userId,
					roomId,
					estimatedUsage
				);
				if (!prediction) return false;

				return calculateUsagePercentage(prediction) >= 100;
			},

			isQuotaAtWarningLevel: (userId, roomId) => {
				const state = get();
				const balance = state.balances[userId]?.[roomId];
				if (!balance) return false;

				const usagePercentage = calculateUsagePercentage(balance);
				return usagePercentage >= balance.warningThreshold;
			},

			getFormattedRemainingTime: (userId, roomId) => {
				const state = get();
				const balance = state.balances[userId]?.[roomId];
				if (!balance || !balance.remainingSeconds) return "0m";

				return formatRemainingTime(balance.remainingSeconds);
			},

			getUsagePercentage: (userId, roomId) => {
				const state = get();
				const balance = state.balances[userId]?.[roomId];
				if (!balance) return 0;

				return calculateUsagePercentage(balance);
			},
		}))
	)
);

// Helper hooks for common use cases
export const useUserQuotaBalance = (userId: string, roomId: string) => {
	return useQuotaStore((state) => state.getBalance(userId, roomId));
};

export const useUserViolations = (userId: string) => {
	return useQuotaStore(
		useShallow((state) => state.getViolationsForUser(userId))
	);
};

export const useQuotaOverrideRequest = () => {
	return useQuotaStore((state) => ({
		requestOverride: state.requestOverride,
		isRequesting: state.isRequestingOverride,
		error: state.error,
	}));
};

export const useQuotaUsagePercentage = (userId: string, roomId: string) => {
	return useQuotaStore((state) => state.getUsagePercentage(userId, roomId));
};

export const useQuotaConnectionStatus = () => {
	return useQuotaStore(
		useShallow((state) => ({
			isConnected: state.isConnected,
			lastSyncTime: state.lastSyncTime,
			error: state.error,
		}))
	);
};

export default useQuotaStore;
