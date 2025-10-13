/**
 * Error Reporting and Analytics System
 * Provides comprehensive error reporting, analytics, and debugging tools
 */

import {
	AppError,
	AppHttpError,
	AppWebSocketError,
	isAppError,
	isAppHttpError,
	isAppWebSocketError,
} from "./error-system";
import { errorMonitor, recordError } from "./error-monitoring";
import { ErrorStatistics } from "../http/error-types";

// =============================================================================
// REPORTING CONFIGURATION
// =============================================================================

/**
 * Error reporting configuration
 */
export interface ErrorReportingConfig {
	// Service endpoints
	reportingEndpoint?: string;
	analyticsEndpoint?: string;

	// Reporting settings
	enableReporting: boolean;
	enableAnalytics: boolean;
	batchSize: number;
	batchTimeout: number;

	// Privacy settings
	sanitizeData: boolean;
	excludePersonalData: boolean;

	// Debug settings
	enableDebugMode: boolean;
	enableSourceMaps: boolean;

	// Callbacks
	onReportSent?: (report: ErrorReport) => void;
	onReportFailed?: (error: Error, report: ErrorReport) => void;
}

/**
 * Default reporting configuration
 */
const DEFAULT_REPORTING_CONFIG: ErrorReportingConfig = {
	enableReporting: process.env.NODE_ENV === "production",
	enableAnalytics: process.env.NODE_ENV === "production",
	batchSize: 10,
	batchTimeout: 30000, // 30 seconds
	sanitizeData: true,
	excludePersonalData: true,
	enableDebugMode: process.env.NODE_ENV === "development",
	enableSourceMaps: process.env.NODE_ENV === "development",
};

// =============================================================================
// REPORT TYPES
// =============================================================================

/**
 * Error report structure
 */
export interface ErrorReport {
	id: string;
	timestamp: number;
	error: {
		name: string;
		message: string;
		code: string;
		category: string;
		severity: string;
		stack?: string;
	};
	context: {
		url?: string;
		userAgent?: string;
		timestamp: number;
		sessionId?: string;
		userId?: string;
		buildVersion?: string;
		environment?: string;
	};
	metadata: Record<string, any>;
	fingerprint: string;
}

/**
 * Analytics event structure
 */
export interface AnalyticsEvent {
	type:
		| "error_occurred"
		| "error_resolved"
		| "threshold_exceeded"
		| "recovery_attempted";
	timestamp: number;
	properties: Record<string, any>;
	userId?: string;
	sessionId?: string;
}

/**
 * Debug information structure
 */
export interface DebugInfo {
	errorId: string;
	timestamp: number;
	error: AppError;
	stackTrace: string;
	sourceMap?: SourceMapInfo;
	breadcrumbs: Breadcrumb[];
	environment: EnvironmentInfo;
	performance: PerformanceInfo;
}

/**
 * Source map information
 */
export interface SourceMapInfo {
	originalFile: string;
	originalLine: number;
	originalColumn: number;
	originalSource: string;
}

/**
 * Breadcrumb for debugging
 */
export interface Breadcrumb {
	timestamp: number;
	category: string;
	message: string;
	level: "debug" | "info" | "warning" | "error";
	data?: Record<string, any>;
}

/**
 * Environment information
 */
export interface EnvironmentInfo {
	userAgent: string;
	url: string;
	referrer: string;
	viewport: { width: number; height: number };
	screen: { width: number; height: number };
	colorDepth: number;
	pixelRatio: number;
	language: string;
	timezone: string;
	cookieEnabled: boolean;
	onlineStatus: boolean;
}

/**
 * Performance information
 */
export interface PerformanceInfo {
	memory?: {
		usedJSHeapSize: number;
		totalJSHeapSize: number;
		jsHeapSizeLimit: number;
	};
	timing?: {
		navigationStart: number;
		loadEventEnd: number;
		domContentLoadedEventEnd: number;
	};
	connection?: {
		effectiveType: string;
		downlink: number;
		rtt: number;
	};
}

// =============================================================================
// ERROR REPORTER
// =============================================================================

/**
 * Comprehensive error reporting system
 */
export class ErrorReporter {
	private config: ErrorReportingConfig;
	private reportQueue: ErrorReport[] = [];
	private analyticsQueue: AnalyticsEvent[] = [];
	private breadcrumbs: Breadcrumb[] = [];
	private batchTimer?: NodeJS.Timeout;
	private sessionId: string;
	private maxBreadcrumbs = 50;

	constructor(config?: Partial<ErrorReportingConfig>) {
		this.config = { ...DEFAULT_REPORTING_CONFIG, ...config };
		this.sessionId = this.generateSessionId();
		this.setupBatchTimer();
		this.setupGlobalErrorHandlers();
		this.addBreadcrumb("system", "ErrorReporter initialized", "info");
	}

	/**
	 * Report an error
	 */
	async reportError(error: AppError): Promise<string> {
		// Record in monitoring system
		const errorId = recordError(error);

		// Create error report
		const report = this.createErrorReport(error, errorId);

		// Add to queue
		if (this.config.enableReporting) {
			this.reportQueue.push(report);
			this.checkBatchSize();
		}

		// Send analytics event
		if (this.config.enableAnalytics) {
			this.trackAnalyticsEvent("error_occurred", {
				errorId,
				code: error.code,
				category: error.category,
				severity: error.severity,
				retryable: error.retryable,
			});
		}

		// Add breadcrumb
		this.addBreadcrumb(
			"error",
			`${error.code}: ${error.message}`,
			"error",
			{
				errorId,
				category: error.category,
				severity: error.severity,
			}
		);

		// Create debug info if in debug mode
		if (this.config.enableDebugMode) {
			const debugInfo = await this.createDebugInfo(error, errorId);
			console.group(`🐛 Error Debug Info: ${error.code}`);
			console.error("Error:", error);
			console.log("Debug Info:", debugInfo);
			console.log("Breadcrumbs:", this.breadcrumbs.slice(-10));
			console.groupEnd();
		}

		return errorId;
	}

	/**
	 * Report error resolution
	 */
	reportErrorResolution(errorId: string, resolution: string): void {
		if (this.config.enableAnalytics) {
			this.trackAnalyticsEvent("error_resolved", {
				errorId,
				resolution,
			});
		}

		this.addBreadcrumb(
			"resolution",
			`Error ${errorId} resolved: ${resolution}`,
			"info",
			{
				errorId,
				resolution,
			}
		);
	}

	/**
	 * Report threshold exceeded
	 */
	reportThresholdExceeded(
		thresholdName: string,
		value: number,
		threshold: number
	): void {
		if (this.config.enableAnalytics) {
			this.trackAnalyticsEvent("threshold_exceeded", {
				thresholdName,
				value,
				threshold,
				ratio: value / threshold,
			});
		}

		this.addBreadcrumb(
			"threshold",
			`Threshold exceeded: ${thresholdName}`,
			"warning",
			{
				thresholdName,
				value,
				threshold,
			}
		);
	}

	/**
	 * Report recovery attempt
	 */
	reportRecoveryAttempt(
		errorId: string,
		strategy: string,
		success: boolean
	): void {
		if (this.config.enableAnalytics) {
			this.trackAnalyticsEvent("recovery_attempted", {
				errorId,
				strategy,
				success,
			});
		}

		this.addBreadcrumb(
			"recovery",
			`Recovery ${success ? "succeeded" : "failed"}: ${strategy}`,
			success ? "info" : "warning",
			{
				errorId,
				strategy,
				success,
			}
		);
	}

	/**
	 * Add breadcrumb for debugging
	 */
	addBreadcrumb(
		category: string,
		message: string,
		level: "debug" | "info" | "warning" | "error",
		data?: Record<string, any>
	): void {
		const breadcrumb: Breadcrumb = {
			timestamp: Date.now(),
			category,
			message,
			level,
			data,
		};

		this.breadcrumbs.push(breadcrumb);

		// Keep only recent breadcrumbs
		if (this.breadcrumbs.length > this.maxBreadcrumbs) {
			this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
		}
	}

	/**
	 * Get error analytics
	 */
	getErrorAnalytics(timeRange?: { start: number; end: number }): {
		statistics: ErrorStatistics;
		trends: Array<{ timestamp: number; count: number; category: string }>;
		insights: Array<{ type: string; message: string; severity: string }>;
	} {
		const statistics = errorMonitor.getStatistics(timeRange);

		// Generate trends (simplified)
		const trends = this.generateErrorTrends(timeRange);

		// Generate insights
		const insights = this.generateErrorInsights(statistics);

		return {
			statistics,
			trends,
			insights,
		};
	}

	/**
	 * Export debug information
	 */
	async exportDebugInfo(errorId?: string): Promise<DebugInfo | DebugInfo[]> {
		if (errorId) {
			// Export specific error debug info
			const error = this.findErrorById(errorId);
			if (!error) {
				throw new Error(`Error not found: ${errorId}`);
			}
			return this.createDebugInfo(error, errorId);
		} else {
			// Export all recent errors
			const recentErrors = this.getRecentErrors(10);
			const debugInfos = await Promise.all(
				recentErrors.map(({ error, id }) =>
					this.createDebugInfo(error, id)
				)
			);
			return debugInfos;
		}
	}

	/**
	 * Flush all pending reports
	 */
	async flushReports(): Promise<void> {
		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
		}

		await Promise.all([this.sendReportBatch(), this.sendAnalyticsBatch()]);
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig: Partial<ErrorReportingConfig>): void {
		this.config = { ...this.config, ...newConfig };
		this.setupBatchTimer();
	}

	/**
	 * Destroy reporter and cleanup
	 */
	destroy(): void {
		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
		}

		// Flush remaining reports
		this.flushReports().catch((error) => {
			console.error("Failed to flush reports during destroy:", error);
		});

		this.reportQueue.length = 0;
		this.analyticsQueue.length = 0;
		this.breadcrumbs.length = 0;
	}

	// =============================================================================
	// PRIVATE METHODS
	// =============================================================================

	private createErrorReport(
		error: AppError,
		errorId: string
	): ErrorReport {
		const report: ErrorReport = {
			id: errorId,
			timestamp: Date.now(),
			error: {
				name: error.name,
				message: error.message,
				code: error.code,
				category: error.category,
				severity: error.severity,
				stack: this.config.enableDebugMode ? error.stack : undefined,
			},
			context: {
				url:
					typeof window !== "undefined"
						? window.location.href
						: undefined,
				userAgent:
					typeof window !== "undefined"
						? window.navigator.userAgent
						: undefined,
				timestamp: error.timestamp,
				sessionId: this.sessionId,
				userId: error.userContext?.userId,
				buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION,
				environment: process.env.NODE_ENV,
			},
			metadata: this.sanitizeMetadata(error.metadata || {}),
			fingerprint: this.generateFingerprint(error),
		};

		return report;
	}

	private async createDebugInfo(
		error: AppError,
		errorId: string
	): Promise<DebugInfo> {
		const debugInfo: DebugInfo = {
			errorId,
			timestamp: Date.now(),
			error,
			stackTrace: error.stack || "",
			breadcrumbs: [...this.breadcrumbs],
			environment: this.getEnvironmentInfo(),
			performance: this.getPerformanceInfo(),
		};

		// Add source map info if available
		if (this.config.enableSourceMaps && error.stack) {
			debugInfo.sourceMap = await this.getSourceMapInfo(error.stack);
		}

		return debugInfo;
	}

	private generateFingerprint(error: AppError): string {
		const components = [
			error.code,
			error.category,
			error.message.substring(0, 100),
		];

		if (isAppHttpError(error)) {
			components.push(String(error.status));
		}

		return btoa(components.join("|")).substring(0, 16);
	}

	private sanitizeMetadata(
		metadata: Record<string, any>
	): Record<string, any> {
		if (!this.config.sanitizeData) {
			return metadata;
		}

		const sanitized = { ...metadata };
		const sensitiveKeys = [
			"password",
			"token",
			"secret",
			"key",
			"auth",
			"authorization",
		];

		const sanitizeObject = (obj: any): any => {
			if (typeof obj !== "object" || obj === null) {
				return obj;
			}

			if (Array.isArray(obj)) {
				return obj.map(sanitizeObject);
			}

			const result: any = {};
			for (const [key, value] of Object.entries(obj)) {
				const lowerKey = key.toLowerCase();
				if (
					sensitiveKeys.some((sensitive) =>
						lowerKey.includes(sensitive)
					)
				) {
					result[key] = "[REDACTED]";
				} else {
					result[key] = sanitizeObject(value);
				}
			}
			return result;
		};

		return sanitizeObject(sanitized);
	}

	private trackAnalyticsEvent(
		type: AnalyticsEvent["type"],
		properties: Record<string, any>
	): void {
		const event: AnalyticsEvent = {
			type,
			timestamp: Date.now(),
			properties: this.sanitizeMetadata(properties),
			sessionId: this.sessionId,
		};

		this.analyticsQueue.push(event);
		this.checkBatchSize();
	}

	private checkBatchSize(): void {
		if (
			this.reportQueue.length >= this.config.batchSize ||
			this.analyticsQueue.length >= this.config.batchSize
		) {
			this.flushReports();
		}
	}

	private setupBatchTimer(): void {
		if (this.batchTimer) {
			clearTimeout(this.batchTimer);
		}

		this.batchTimer = setTimeout(() => {
			this.flushReports();
		}, this.config.batchTimeout);
	}

	private async sendReportBatch(): Promise<void> {
		if (this.reportQueue.length === 0 || !this.config.reportingEndpoint) {
			return;
		}

		const batch = [...this.reportQueue];
		this.reportQueue.length = 0;

		try {
			const response = await fetch(this.config.reportingEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: "error_batch",
					timestamp: Date.now(),
					sessionId: this.sessionId,
					reports: batch,
				}),
			});

			if (!response.ok) {
				throw new Error(
					`HTTP ${response.status}: ${response.statusText}`
				);
			}

			// Trigger success callback
			if (this.config.onReportSent) {
				batch.forEach((report) => this.config.onReportSent!(report));
			}

			console.log(`Sent ${batch.length} error reports`);
		} catch (error) {
			console.error("Failed to send error reports:", error);

			// Trigger failure callback
			if (this.config.onReportFailed) {
				batch.forEach((report) =>
					this.config.onReportFailed!(error as Error, report)
				);
			}

			// Re-queue reports for retry (with limit)
			if (batch.length < 100) {
				// Prevent infinite growth
				this.reportQueue.unshift(...batch);
			}
		}
	}

	private async sendAnalyticsBatch(): Promise<void> {
		if (
			this.analyticsQueue.length === 0 ||
			!this.config.analyticsEndpoint
		) {
			return;
		}

		const batch = [...this.analyticsQueue];
		this.analyticsQueue.length = 0;

		try {
			const response = await fetch(this.config.analyticsEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: "analytics_batch",
					timestamp: Date.now(),
					sessionId: this.sessionId,
					events: batch,
				}),
			});

			if (!response.ok) {
				throw new Error(
					`HTTP ${response.status}: ${response.statusText}`
				);
			}

			console.log(`Sent ${batch.length} analytics events`);
		} catch (error) {
			console.error("Failed to send analytics events:", error);

			// Re-queue events for retry (with limit)
			if (batch.length < 100) {
				this.analyticsQueue.unshift(...batch);
			}
		}
	}

	private generateErrorTrends(timeRange?: {
		start: number;
		end: number;
	}): Array<{ timestamp: number; count: number; category: string }> {
		// Simplified trend generation - in a real implementation,
		// this would analyze historical data
		const now = Date.now();
		const start = timeRange?.start || now - 24 * 60 * 60 * 1000;
		const end = timeRange?.end || now;

		const trends: Array<{
			timestamp: number;
			count: number;
			category: string;
		}> = [];

		// Generate hourly data points
		for (let time = start; time < end; time += 60 * 60 * 1000) {
			trends.push({
				timestamp: time,
				count: Math.floor(Math.random() * 10), // Mock data
				category: "total",
			});
		}

		return trends;
	}

	private generateErrorInsights(
		statistics: ErrorStatistics
	): Array<{ type: string; message: string; severity: string }> {
		const insights: Array<{
			type: string;
			message: string;
			severity: string;
		}> = [];

		// High error rate insight
		if (statistics.errorRate > 0.1) {
			insights.push({
				type: "high_error_rate",
				message: `Error rate is ${(statistics.errorRate * 100).toFixed(
					2
				)}% which is above normal`,
				severity: "warning",
			});
		}

		// Increasing trend insight
		if (statistics.errorTrend === "increasing") {
			insights.push({
				type: "increasing_trend",
				message: "Error rate is increasing compared to previous period",
				severity: "warning",
			});
		}

		// Top error insight
		if (statistics.topErrors.length > 0) {
			const topError = statistics.topErrors[0];
			if (topError.percentage > 50) {
				insights.push({
					type: "dominant_error",
					message: `One error type accounts for ${topError.percentage.toFixed(
						1
					)}% of all errors`,
					severity: "info",
				});
			}
		}

		return insights;
	}

	private getEnvironmentInfo(): EnvironmentInfo {
		if (typeof window === "undefined") {
			return {} as EnvironmentInfo;
		}

		return {
			userAgent: window.navigator.userAgent,
			url: window.location.href,
			referrer: document.referrer,
			viewport: {
				width: window.innerWidth,
				height: window.innerHeight,
			},
			screen: {
				width: window.screen.width,
				height: window.screen.height,
			},
			colorDepth: window.screen.colorDepth,
			pixelRatio: window.devicePixelRatio,
			language: window.navigator.language,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			cookieEnabled: window.navigator.cookieEnabled,
			onlineStatus: window.navigator.onLine,
		};
	}

	private getPerformanceInfo(): PerformanceInfo {
		const info: PerformanceInfo = {};

		if (typeof window === "undefined") {
			return info;
		}

		// Memory info
		if ("memory" in performance) {
			const memory = (performance as any).memory;
			info.memory = {
				usedJSHeapSize: memory.usedJSHeapSize,
				totalJSHeapSize: memory.totalJSHeapSize,
				jsHeapSizeLimit: memory.jsHeapSizeLimit,
			};
		}

		// Timing info
		if (performance.timing) {
			info.timing = {
				navigationStart: performance.timing.navigationStart,
				loadEventEnd: performance.timing.loadEventEnd,
				domContentLoadedEventEnd:
					performance.timing.domContentLoadedEventEnd,
			};
		}

		// Connection info
		if ("connection" in navigator) {
			const connection = (navigator as any).connection;
			info.connection = {
				effectiveType: connection.effectiveType,
				downlink: connection.downlink,
				rtt: connection.rtt,
			};
		}

		return info;
	}

	private async getSourceMapInfo(
		stack: string
	): Promise<SourceMapInfo | undefined> {
		// Simplified source map parsing - in a real implementation,
		// this would parse source maps to get original file locations
		try {
			const stackLines = stack.split("\n");
			const firstLine = stackLines.find((line) => line.includes(".js:"));

			if (firstLine) {
				const match = firstLine.match(/([^/]+\.js):(\d+):(\d+)/);
				if (match) {
					return {
						originalFile: match[1],
						originalLine: parseInt(match[2]),
						originalColumn: parseInt(match[3]),
						originalSource: firstLine,
					};
				}
			}
		} catch (error) {
			console.warn("Failed to parse source map info:", error);
		}

		return undefined;
	}
}
