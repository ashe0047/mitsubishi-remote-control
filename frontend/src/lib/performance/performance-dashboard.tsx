"use client";

/**
 * Performance Monitoring Dashboard
 * Provides comprehensive performance monitoring UI for HTTP and WebSocket connections
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Network,
  MessageSquare,
  Zap,
  BarChart3,
  Settings,
} from 'lucide-react';

import { performanceMonitor } from './performance-monitor';
import { performanceInterceptor } from '../http/performance-interceptor';
import { webSocketPerformanceMonitor, WebSocketPerformanceAlert } from './websocket-performance-monitor';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface DashboardState {
  httpMetrics: any;
  websocketMetrics: any;
  websocketAlerts: WebSocketPerformanceAlert[];
  performanceMetrics: any[];
  isMonitoringEnabled: boolean;
  refreshInterval: number;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'error';
  description?: string;
  icon?: React.ReactNode;
}

interface AlertCardProps {
  alert: WebSocketPerformanceAlert;
  onDismiss?: (alert: WebSocketPerformanceAlert) => void;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatMetricValue(value: number, decimals = 1): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(decimals)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(decimals)}K`;
  }
  return value.toFixed(decimals);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function getHealthColor(score: number): string {
  if (score >= 90) return 'text-green-600 dark:text-green-400';
  if (score >= 75) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 50) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function getSeverityColor(severity: WebSocketPerformanceAlert['severity']): string {
  switch (severity) {
    case 'critical': return 'text-red-600 dark:text-red-400';
    case 'high': return 'text-orange-600 dark:text-orange-400';
    case 'medium': return 'text-yellow-600 dark:text-yellow-400';
    case 'low': return 'text-blue-600 dark:text-blue-400';
    default: return 'text-gray-600 dark:text-gray-400';
  }
}

// =============================================================================
// COMPONENTS
// =============================================================================

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  unit, 
  trend, 
  status = 'good', 
  description,
  icon 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'text-green-600 dark:text-green-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3" />;
    return null;
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="flex items-center gap-1">
            {icon}
            {getTrendIcon()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-baseline gap-1">
          <span className={cn("text-2xl font-bold", getStatusColor())}>
            {value}
          </span>
          {unit && (
            <span className="text-sm text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
        {description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground mt-1 cursor-help truncate">
                {description}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <p>{description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  );
};

const AlertCard: React.FC<AlertCardProps> = ({ alert, onDismiss }) => {
  const getSeverityBadge = () => {
    const color = getSeverityColor(alert.severity);
    return (
      <Badge 
        variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
        className={cn("text-xs", color)}
      >
        {alert.severity.toUpperCase()}
      </Badge>
    );
  };

  const getAlertIcon = () => {
    switch (alert.severity) {
      case 'critical':
      case 'high':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getAlertIcon()}
            <span className="text-sm font-medium">{alert.type.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-center gap-2">
            {getSeverityBadge()}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(alert)}
                className="h-6 w-6 p-0"
              >
                <XCircle className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-2">
          {alert.message}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Value: {formatMetricValue(alert.value)}</span>
          <span>Threshold: {formatMetricValue(alert.threshold)}</span>
          <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
        </div>
        {alert.recommendations.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium mb-1">Recommendations:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {alert.recommendations.slice(0, 2).map((rec, index) => (
                <li key={index} className="flex items-start gap-1">
                  <span>•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export const PerformanceDashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({
    httpMetrics: null,
    websocketMetrics: null,
    websocketAlerts: [],
    performanceMetrics: [],
    isMonitoringEnabled: true,
    refreshInterval: 5000,
  });

  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Update metrics periodically
  useEffect(() => {
    if (!state.isMonitoringEnabled) return;

    const updateMetrics = () => {
      const httpMetrics = performanceInterceptor.getPerformanceMetrics();
      const websocketMetrics = webSocketPerformanceMonitor.getMetrics();
      const websocketAlerts = webSocketPerformanceMonitor.getAlerts();
      const performanceMetrics = performanceMonitor.getMetrics();

      setState(prev => ({
        ...prev,
        httpMetrics,
        websocketMetrics,
        websocketAlerts: websocketAlerts.filter(alert => 
          !dismissedAlerts.has(`${alert.type}-${alert.timestamp}`)
        ),
        performanceMetrics,
      }));
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, state.refreshInterval);

    return () => clearInterval(interval);
  }, [state.isMonitoringEnabled, state.refreshInterval, dismissedAlerts]);

  // Computed metrics
  const computedMetrics = useMemo(() => {
    const { httpMetrics, websocketMetrics, performanceMetrics } = state;
    
    if (!httpMetrics || !websocketMetrics) return null;

    return {
      overallHealth: Math.round((websocketMetrics.connectionHealthScore + 
        (httpMetrics.errorRate < 5 ? 95 : 100 - httpMetrics.errorRate * 10)) / 2),
      totalRequests: httpMetrics.totalRequests + websocketMetrics.messagesSent,
      averageLatency: (httpMetrics.averageResponseTime + websocketMetrics.networkLatency) / 2,
      connectionStability: websocketMetrics.connectionStability,
      memoryUsage: websocketMetrics.memoryUsage || 0,
      bandwidthUsage: websocketMetrics.bandwidthUsage || 0,
    };
  }, [state.httpMetrics, state.websocketMetrics]);

  const handleDismissAlert = (alert: WebSocketPerformanceAlert) => {
    const alertKey = `${alert.type}-${alert.timestamp}`;
    setDismissedAlerts(prev => new Set(prev).add(alertKey));
  };

  const handleToggleMonitoring = () => {
    setState(prev => ({
      ...prev,
      isMonitoringEnabled: !prev.isMonitoringEnabled,
    }));
  };

  const handleClearMetrics = () => {
    performanceMonitor.clearMetrics();
    performanceInterceptor.resetMetrics();
    webSocketPerformanceMonitor.reset();
    setDismissedAlerts(new Set());
  };

  if (!computedMetrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading performance metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of HTTP and WebSocket performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleMonitoring}
            className="flex items-center gap-2"
          >
            {state.isMonitoringEnabled ? (
              <Activity className="h-4 w-4 animate-pulse text-green-600" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            {state.isMonitoringEnabled ? 'Monitoring' : 'Paused'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearMetrics}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Overall Health */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Overall System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className={cn("text-4xl font-bold", getHealthColor(computedMetrics.overallHealth))}>
                {computedMetrics.overallHealth}%
              </div>
              <p className="text-sm text-muted-foreground">Health Score</p>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {formatMetricValue(computedMetrics.totalRequests, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Total Requests</p>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {formatDuration(computedMetrics.averageLatency)}
                  </div>
                  <p className="text-xs text-muted-foreground">Avg Latency</p>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {computedMetrics.connectionStability.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {formatBytes(computedMetrics.memoryUsage)}
                  </div>
                  <p className="text-xs text-muted-foreground">Memory</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {state.websocketAlerts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            Performance Alerts ({state.websocketAlerts.length})
          </h3>
          <div className="grid gap-3">
            {state.websocketAlerts.slice(0, 5).map((alert, index) => (
              <AlertCard
                key={`${alert.type}-${alert.timestamp}-${index}`}
                alert={alert}
                onDismiss={handleDismissAlert}
              />
            ))}
          </div>
        </div>
      )}

      {/* HTTP Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Network className="h-5 w-5" />
          HTTP Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Requests"
            value={formatMetricValue(state.httpMetrics.totalRequests, 0)}
            icon={<Database className="h-4 w-4" />}
            status={state.httpMetrics.totalRequests > 0 ? 'good' : 'warning'}
          />
          <MetricCard
            title="Average Response Time"
            value={state.httpMetrics.averageResponseTime.toFixed(0)}
            unit="ms"
            icon={<Clock className="h-4 w-4" />}
            status={state.httpMetrics.averageResponseTime < 1000 ? 'good' : 
                   state.httpMetrics.averageResponseTime < 3000 ? 'warning' : 'error'}
          />
          <MetricCard
            title="Cache Hit Rate"
            value={(state.httpMetrics.cacheHitRate * 100).toFixed(1)}
            unit="%"
            icon={<Zap className="h-4 w-4" />}
            status={state.httpMetrics.cacheHitRate > 0.5 ? 'good' : 'warning'}
          />
          <MetricCard
            title="Concurrent Requests"
            value={state.httpMetrics.concurrentRequests}
            icon={<Activity className="h-4 w-4" />}
            status={state.httpMetrics.concurrentRequests < 10 ? 'good' : 'warning'}
            description={`Peak: ${state.httpMetrics.maxConcurrentRequests}`}
          />
        </div>
      </div>

      {/* WebSocket Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          WebSocket Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Connection Health"
            value={state.websocketMetrics.connectionHealthScore}
            unit="%"
            icon={state.websocketMetrics.connectionHealthScore > 80 ? 
                  <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            status={state.websocketMetrics.connectionHealthScore > 80 ? 'good' : 
                   state.websocketMetrics.connectionHealthScore > 50 ? 'warning' : 'error'}
          />
          <MetricCard
            title="Messages Sent"
            value={formatMetricValue(state.websocketMetrics.messagesSent, 0)}
            icon={<MessageSquare className="h-4 w-4" />}
            status="good"
            description={`Throughput: ${state.websocketMetrics.messageThroughputSent.toFixed(1)}/s`}
          />
          <MetricCard
            title="Network Latency"
            value={state.websocketMetrics.networkLatency.toFixed(0)}
            unit="ms"
            icon={<Network className="h-4 w-4" />}
            status={state.websocketMetrics.networkLatency < 500 ? 'good' : 
                   state.websocketMetrics.networkLatency < 1000 ? 'warning' : 'error'}
          />
          <MetricCard
            title="Message Queue"
            value={state.websocketMetrics.messageQueueSize}
            icon={<Database className="h-4 w-4" />}
            status={state.websocketMetrics.messageQueueSize < 10 ? 'good' : 
                   state.websocketMetrics.messageQueueSize < 50 ? 'warning' : 'error'}
            description={`Peak: ${state.websocketMetrics.messageQueuePeak}`}
          />
        </div>
      </div>

      {/* Additional Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Additional Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Connection Uptime"
            value={formatDuration(state.websocketMetrics.connectionUptime)}
            icon={<Clock className="h-4 w-4" />}
            status="good"
          />
          <MetricCard
            title="Reconnections"
            value={state.websocketMetrics.reconnectionCount}
            icon={<Activity className="h-4 w-4" />}
            status={state.websocketMetrics.reconnectionCount < 5 ? 'good' : 'warning'}
          />
          <MetricCard
            title="Bandwidth Usage"
            value={formatBytes(state.websocketMetrics.bandwidthUsage * 60)} // per minute
            unit="/min"
            icon={<Network className="h-4 w-4" />}
            status="good"
          />
          <MetricCard
            title="Memory Usage"
            value={formatBytes(state.websocketMetrics.memoryUsage)}
            icon={<Database className="h-4 w-4" />}
            status={state.websocketMetrics.memoryUsage < 100 * 1024 * 1024 ? 'good' : 'warning'}
          />
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;