import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuotaWebSocketContext } from "@/lib/quota/quota-websocket";

interface QuotaConnectionStatusProps {
	showDetails?: boolean;
	showReconnectButton?: boolean;
	className?: string;
}

export const QuotaConnectionStatus: React.FC<QuotaConnectionStatusProps> = ({
	showDetails = false,
	showReconnectButton = false,
	className = "",
}) => {
	const {
		isConnected,
		isConnecting,
		isReconnecting,
		connectionError,
		retryCount,
		queuedMessages,
		connectionStatus,
		forceReconnect,
		getPerformanceMetrics,
	} = useQuotaWebSocketContext();

	const getStatusColor = () => {
		if (isConnected && connectionStatus.isHealthy) return "success";
		if (isConnecting || isReconnecting) return "warning";
		return "destructive";
	};

	const getStatusText = () => {
		if (isConnected && connectionStatus.isHealthy) return "Connected";
		if (isReconnecting) return "Reconnecting...";
		if (isConnecting) return "Connecting...";
		if (connectionError) return "Connection Error";
		return "Disconnected";
	};

	const handleReconnect = async () => {
		try {
			await forceReconnect();
		} catch (error) {
			console.error("Manual reconnect failed:", error);
		}
	};

	const performanceMetrics = getPerformanceMetrics();

	return (
		<div className={`flex items-center gap-2 ${className}`}>
			<Badge variant={getStatusColor() as 'default' | 'secondary' | 'destructive' | 'outline'}>
				{getStatusText()}
			</Badge>

			{showReconnectButton && !isConnected && (
				<Button
					size="sm"
					variant="outline"
					onClick={handleReconnect}
					disabled={isConnecting || isReconnecting}
				>
					Reconnect
				</Button>
			)}

			{showDetails && (
				<div className="text-xs text-muted-foreground">
					{retryCount > 0 && <span>Retries: {retryCount}</span>}
					{queuedMessages > 0 && (
						<span className="ml-2">Queued: {queuedMessages}</span>
					)}
					{connectionStatus.lastHealthCheck && (
						<span className="ml-2">
							Last check: {new Date(connectionStatus.lastHealthCheck).toLocaleTimeString()}
						</span>
					)}
					{performanceMetrics && (
						<span className="ml-2">
							Uptime: {Math.round(performanceMetrics.connectionUptime / 1000)}s
						</span>
					)}
				</div>
			)}

			{connectionError && (
				<div className="text-xs text-destructive">
					{connectionError}
				</div>
			)}
		</div>
	);
};

export default QuotaConnectionStatus;