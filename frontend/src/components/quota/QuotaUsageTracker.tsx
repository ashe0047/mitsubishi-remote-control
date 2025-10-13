"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  Activity, 
  Zap, 
  DollarSign, 
  AlertTriangle,
  RefreshCw,
  Pause,
  Play 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuotaWebSocketContext } from '@/lib/quota/quota-websocket';
import type { WebSocketMessage } from '@/lib/websocket/types';

export interface QuotaUsage {
  quotaId: string;
  familyMemberId: string;
  roomId: string;
  quotaType: 'TIME_BASED' | 'USAGE_BASED' | 'ENERGY_BASED' | 'COST_BASED';
  
  // Current usage values
  currentUsage: number; // seconds for TIME, count for USAGE, kWh for ENERGY, dollars for COST
  dailyLimit: number;
  
  // Status and metadata
  status: 'ACTIVE' | 'WARNING' | 'EXCEEDED' | 'PAUSED';
  warningThreshold: number; // percentage
  resetTime: string; // ISO timestamp for next reset
  lastUpdated: string; // ISO timestamp
  
  // Real-time session tracking
  isCurrentlyActive: boolean; // is AC currently running
  sessionStartTime?: string; // when current session started
  estimatedSessionUsage: number; // current session usage
}

export interface UsageTrackerProps {
  quotaId: string;
  familyMemberId: string;
  roomId: string;
  onUsageUpdate?: (usage: QuotaUsage) => void;
  onStatusChange?: (status: QuotaUsage['status']) => void;
  className?: string;
}

export const QuotaUsageTracker: React.FC<UsageTrackerProps> = ({
  quotaId,
  familyMemberId,
  roomId,
  onUsageUpdate,
  onStatusChange,
  className,
}) => {
  const [usage, setUsage] = useState<QuotaUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get WebSocket connection for real-time updates
  const { sendMessage, isConnected } = useQuotaWebSocketContext();

  // Real-time usage tracking
  useEffect(() => {
    // TODO: Replace with actual WebSocket connection to backend
    const mockUsage: QuotaUsage = {
      quotaId,
      familyMemberId,
      roomId,
      quotaType: 'TIME_BASED',
      currentUsage: 1.5 * 3600, // 1.5 hours in seconds
      dailyLimit: 3 * 3600, // 3 hours in seconds
      status: 'ACTIVE',
      warningThreshold: 75,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lastUpdated: new Date().toISOString(),
      isCurrentlyActive: true,
      sessionStartTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      estimatedSessionUsage: 30 * 60, // 30 minutes in seconds
    };

    setUsage(mockUsage);
    setIsLoading(false);
    onUsageUpdate?.(mockUsage);
  }, [quotaId, familyMemberId, roomId, onUsageUpdate]);

  // Real-time updates simulation (replace with actual WebSocket)
  useEffect(() => {
    if (!usage?.isCurrentlyActive) return;

    const interval = setInterval(() => {
      setUsage(prevUsage => {
        if (!prevUsage?.isCurrentlyActive) return prevUsage;

        const now = new Date().toISOString();
        const newSessionUsage = prevUsage.estimatedSessionUsage + 1; // Add 1 second
        const newCurrentUsage = prevUsage.currentUsage + 1;
        
        // Calculate new status
        const usagePercent = (newCurrentUsage / prevUsage.dailyLimit) * 100;
        let newStatus: QuotaUsage['status'] = 'ACTIVE';
        
        if (usagePercent >= 100) {
          newStatus = 'EXCEEDED';
        } else if (usagePercent >= prevUsage.warningThreshold) {
          newStatus = 'WARNING';
        }

        const updatedUsage = {
          ...prevUsage,
          currentUsage: newCurrentUsage,
          estimatedSessionUsage: newSessionUsage,
          status: newStatus,
          lastUpdated: now,
        };

        if (newStatus !== prevUsage.status) {
          onStatusChange?.(newStatus);
        }

        onUsageUpdate?.(updatedUsage);
        return updatedUsage;
      });
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [usage?.isCurrentlyActive, onStatusChange, onUsageUpdate]);

  const getUsageIcon = (type: QuotaUsage['quotaType']) => {
    switch (type) {
      case 'TIME_BASED': return Clock;
      case 'USAGE_BASED': return Activity;
      case 'ENERGY_BASED': return Zap;
      case 'COST_BASED': return DollarSign;
      default: return Clock;
    }
  };

  const getStatusColor = (status: QuotaUsage['status']) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 dark:text-green-400';
      case 'WARNING': return 'text-yellow-600 dark:text-yellow-400';
      case 'EXCEEDED': return 'text-red-600 dark:text-red-400';
      case 'PAUSED': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatUsage = (type: QuotaUsage['quotaType'], usage: number) => {
    switch (type) {
      case 'TIME_BASED':
        const hours = Math.floor(usage / 3600);
        const minutes = Math.floor((usage % 3600) / 60);
        return `${hours}h ${minutes}m`;
      case 'USAGE_BASED':
        return `${usage} use${usage !== 1 ? 's' : ''}`;
      case 'ENERGY_BASED':
        return `${(usage / 1000).toFixed(2)} kWh`;
      case 'COST_BASED':
        return `$${usage.toFixed(2)}`;
      default:
        return `${usage}`;
    }
  };

  const formatLimit = (type: QuotaUsage['quotaType'], limit: number) => {
    return formatUsage(type, limit);
  };

  const getUsagePercent = () => {
    if (!usage) return 0;
    return Math.min((usage.currentUsage / usage.dailyLimit) * 100, 100);
  };

  const getTimeUntilReset = () => {
    if (!usage) return '';
    const resetTime = new Date(usage.resetTime);
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Resetting...';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `Resets in ${hours}h ${minutes}m`;
    } else {
      return `Resets in ${minutes}m`;
    }
  };

  const handlePauseResume = useCallback(async () => {
    if (!usage || !sendMessage) return;

    try {
      const newStatus: QuotaUsage['status'] = usage.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
      const action = newStatus === 'PAUSED' ? 'PAUSE_TRACKING' : 'RESUME_TRACKING';

      // Send pause/resume message via WebSocket
      const message: WebSocketMessage = {
        type: 'quota',
        messageId: `quota-${action.toLowerCase()}-${Date.now()}`,
        roomId: roomId,
        payload: {
          quotaId: quotaId,
          familyMemberId: familyMemberId,
          action: action,
          timestamp: Date.now()
        }
      };

      await sendMessage(message);

      // Optimistically update local state
      setUsage(prev => {
        if (!prev) return prev;

        const updatedUsage = {
          ...prev,
          status: newStatus,
          isCurrentlyActive: newStatus === 'ACTIVE' ? prev.isCurrentlyActive : false,
          lastUpdated: new Date().toISOString(),
        };

        // Notify parent components of status change
        onStatusChange?.(updatedUsage.status);
        onUsageUpdate?.(updatedUsage);

        return updatedUsage;
      });

      console.log(`Quota tracking ${action.toLowerCase()} for ${quotaId}`);

    } catch (error) {
      console.error('Failed to pause/resume quota tracking:', error);
      setError(`Failed to ${usage.status === 'PAUSED' ? 'resume' : 'pause'} tracking. Please try again.`);
    }
  }, [usage, sendMessage, roomId, quotaId, familyMemberId, onStatusChange, onUsageUpdate]);

  const handleRefresh = useCallback(async () => {
    if (!sendMessage) return;

    setIsLoading(true);
    setError(null);

    try {
      // Send refresh message via WebSocket to get latest quota data
      const message: WebSocketMessage = {
        type: 'quota',
        messageId: `quota-refresh-${Date.now()}`,
        roomId: roomId,
        payload: {
          quotaId: quotaId,
          familyMemberId: familyMemberId,
          action: 'REFRESH_USAGE',
          timestamp: Date.now()
        }
      };

      await sendMessage(message);
      console.log(`Refreshing quota data for ${quotaId}`);

      // The response will be handled by the WebSocket message handler
      // For now, simulate the refresh completion
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);

    } catch (error) {
      console.error('Failed to refresh quota data:', error);
      setError('Failed to refresh quota data. Please try again.');
      setIsLoading(false);
    }
  }, [sendMessage, roomId, quotaId, familyMemberId]);

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            className="ml-2"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!usage) {
    return (
      <Alert className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>No usage data available</AlertDescription>
      </Alert>
    );
  }

  const Icon = getUsageIcon(usage.quotaType);
  const usagePercent = getUsagePercent();

  return (
    <Card className={cn("space-y-0", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Quota Usage</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={usage.status === 'EXCEEDED' ? 'destructive' : 'outline'}
              className={cn("text-xs", getStatusColor(usage.status))}
            >
              {usage.status}
              {usage.isCurrentlyActive && usage.status !== 'PAUSED' && (
                <div className="ml-1 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              )}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          {formatUsage(usage.quotaType, usage.currentUsage)} of {formatLimit(usage.quotaType, usage.dailyLimit)} used
          {usage.isCurrentlyActive && (
            <span className="ml-2 text-primary">
              • Currently active ({formatUsage(usage.quotaType, usage.estimatedSessionUsage)} this session)
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className={cn("font-medium", getStatusColor(usage.status))}>
              {usagePercent.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={usagePercent} 
            className={cn(
              "h-2",
              usage.status === 'EXCEEDED' && "bg-red-100 dark:bg-red-950"
            )}
            style={{
              background: usage.status === 'EXCEEDED' 
                ? 'linear-gradient(to right, rgb(239 68 68), rgb(220 38 38))' 
                : undefined
            }}
          />
        </div>

        {/* Status Messages */}
        {usage.status === 'WARNING' && (
          <Alert variant="default" className="border-yellow-200 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-sm">
              Approaching daily limit ({usage.warningThreshold}% threshold reached)
            </AlertDescription>
          </Alert>
        )}

        {usage.status === 'EXCEEDED' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Daily quota exceeded. AC usage may be restricted.
            </AlertDescription>
          </Alert>
        )}

        {/* Reset Information */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{getTimeUntilReset()}</span>
          <span>Updated {new Date(usage.lastUpdated).toLocaleTimeString()}</span>
        </div>

        {/* Control Actions */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePauseResume}
            disabled={usage.status === 'EXCEEDED'}
            className="flex-1"
          >
            {usage.isCurrentlyActive ? (
              <>
                <Pause className="mr-2 h-3 w-3" />
                Pause Tracking
              </>
            ) : (
              <>
                <Play className="mr-2 h-3 w-3" />
                Resume Tracking
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuotaUsageTracker;