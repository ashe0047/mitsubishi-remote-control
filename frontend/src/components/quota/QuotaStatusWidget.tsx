"use client";

import React, { useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Zap,
  DollarSign,
  Activity,
  Loader2
} from 'lucide-react';
import { useUserQuotaBalance, useQuotaUsagePercentage } from '@/stores/quota-store';
import { QuotaBalance } from '@/stores/quota-store';
import { cn } from '@/lib/utils';

interface QuotaStatusWidgetProps {
  userId: string;
  roomId: string;
  className?: string;
  showDetails?: boolean;
  showActions?: boolean;
  onRequestOverride?: () => void;
  compact?: boolean;
}

/**
 * Quota Status Widget - Displays real-time quota status for a user/room combination
 * Features:
 * - Real-time usage progress
 * - Multiple quota types (time, usage, energy, cost)
 * - Warning and violation indicators
 * - Override request functionality
 * - Compact and detailed view modes
 */
export const QuotaStatusWidget: React.FC<QuotaStatusWidgetProps> = ({
  userId,
  roomId,
  className,
  showDetails = true,
  showActions = true,
  onRequestOverride,
  compact = false,
}) => {
  // Use Zustand v5 safe selector patterns
  const quotaBalance = useUserQuotaBalance(userId, roomId);
  const usagePercentage = useQuotaUsagePercentage(userId, roomId);

  // Helper functions with useCallback to prevent rerenders
  const getQuotaTypeInfo = useCallback((balance: QuotaBalance) => {
    if (balance.totalSeconds !== undefined) {
      return {
        type: 'Time',
        icon: <Clock className="h-4 w-4" />,
        total: balance.totalSeconds,
        used: balance.usedSeconds || 0,
        remaining: balance.remainingSeconds || 0,
        unit: 'seconds',
        formatter: (seconds: number) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
      };
    }
    
    if (balance.totalUsageCount !== undefined) {
      return {
        type: 'Usage',
        icon: <Activity className="h-4 w-4" />,
        total: balance.totalUsageCount,
        used: balance.usedUsageCount || 0,
        remaining: balance.remainingUsageCount || 0,
        unit: 'uses',
        formatter: (count: number) => `${count} uses`
      };
    }
    
    if (balance.totalEnergyKwh !== undefined) {
      return {
        type: 'Energy',
        icon: <Zap className="h-4 w-4" />,
        total: balance.totalEnergyKwh,
        used: balance.usedEnergyKwh || 0,
        remaining: balance.remainingEnergyKwh || 0,
        unit: 'kWh',
        formatter: (kwh: number) => `${kwh.toFixed(2)} kWh`
      };
    }
    
    if (balance.totalCostAmount !== undefined) {
      return {
        type: 'Cost',
        icon: <DollarSign className="h-4 w-4" />,
        total: balance.totalCostAmount,
        used: balance.usedCostAmount || 0,
        remaining: balance.remainingCostAmount || 0,
        unit: 'currency',
        formatter: (amount: number) => `$${amount.toFixed(2)}`
      };
    }
    
    return null;
  }, []);

  const getStatusColor = useCallback((percentage: number, isExceeded: boolean) => {
    if (isExceeded) return 'text-red-600 bg-red-50 border-red-200';
    if (percentage >= 90) return 'text-red-600 bg-red-50 border-red-200';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  }, []);

  const getStatusIcon = useCallback((percentage: number, isExceeded: boolean, hasOverride: boolean) => {
    if (hasOverride) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (isExceeded) return <XCircle className="h-4 w-4 text-red-600" />;
    if (percentage >= 90) return <AlertTriangle className="h-4 w-4 text-red-600" />;
    if (percentage >= 75) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  }, []);

  const getStatusText = useCallback((percentage: number, isExceeded: boolean, hasOverride: boolean) => {
    if (hasOverride) return 'Override Active';
    if (isExceeded) return 'Quota Exceeded';
    if (percentage >= 90) return 'Critical Usage';
    if (percentage >= 75) return 'High Usage';
    return 'Normal Usage';
  }, []);

  // Loading state
  if (!quotaBalance) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-muted-foreground">Loading quota status...</span>
        </CardContent>
      </Card>
    );
  }

  const quotaInfo = getQuotaTypeInfo(quotaBalance);
  
  if (!quotaInfo) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No quota configuration found
          </div>
        </CardContent>
      </Card>
    );
  }

  const isExceeded = quotaBalance.isExceeded || false;
  const hasOverride = quotaBalance.hasOverride || false;
  const statusColor = getStatusColor(usagePercentage, isExceeded);
  const statusIcon = getStatusIcon(usagePercentage, isExceeded, hasOverride);
  const statusText = getStatusText(usagePercentage, isExceeded, hasOverride);

  if (compact) {
    return (
      <div className={cn("flex items-center space-x-3 p-3 border rounded-lg", statusColor, className)}>
        <div className="flex items-center space-x-2">
          {quotaInfo.icon}
          {statusIcon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {quotaInfo.formatter(quotaInfo.remaining)} remaining
          </div>
          <Progress value={usagePercentage} className="h-1 mt-1" />
        </div>
        <Badge variant={isExceeded ? "destructive" : usagePercentage >= 75 ? "secondary" : "default"} className="text-xs">
          {Math.round(usagePercentage)}%
        </Badge>
      </div>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center space-x-2">
            {quotaInfo.icon}
            <span>{quotaInfo.type} Quota</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            {statusIcon}
            <Badge 
              variant={isExceeded ? "destructive" : usagePercentage >= 75 ? "secondary" : "default"}
              className="text-xs"
            >
              {statusText}
            </Badge>
          </div>
        </div>
        {showDetails && (
          <CardDescription>
            Room: {roomId} • Updated: {new Date(quotaBalance.lastUpdated).toLocaleTimeString()}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Usage Progress</span>
            <span className={cn(
              "font-medium",
              isExceeded ? "text-red-600" : usagePercentage >= 75 ? "text-yellow-600" : "text-green-600"
            )}>
              {Math.round(usagePercentage)}%
            </span>
          </div>
          <Progress 
            value={usagePercentage} 
            className={cn(
              "h-2",
              isExceeded && "bg-red-100 [&>div]:bg-red-500",
              usagePercentage >= 75 && !isExceeded && "bg-yellow-100 [&>div]:bg-yellow-500"
            )}
          />
        </div>

        {/* Usage Details */}
        {showDetails && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-2 bg-muted/30 rounded">
              <div className="text-xs text-muted-foreground">Used</div>
              <div className="font-medium">{quotaInfo.formatter(quotaInfo.used)}</div>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded">
              <div className="text-xs text-muted-foreground">Remaining</div>
              <div className="font-medium">{quotaInfo.formatter(quotaInfo.remaining)}</div>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-medium">{quotaInfo.formatter(quotaInfo.total)}</div>
            </div>
          </div>
        )}

        {/* Warning Messages */}
        {isExceeded && !hasOverride && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Quota has been exceeded. AC access may be restricted until quota resets or override is granted.
            </AlertDescription>
          </Alert>
        )}
        
        {!isExceeded && usagePercentage >= 75 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Approaching quota limit ({Math.round(usagePercentage)}% used). Consider reducing usage.
            </AlertDescription>
          </Alert>
        )}

        {hasOverride && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-green-700">
              Override is currently active. Normal quota restrictions are suspended.
            </AlertDescription>
          </Alert>
        )}

        {/* Reset Information */}
        {showDetails && quotaBalance.resetTime && (
          <div className="text-xs text-muted-foreground">
            Quota resets: {new Date(quotaBalance.resetTime).toLocaleString()}
          </div>
        )}

        {/* Action Buttons */}
        {showActions && isExceeded && !hasOverride && onRequestOverride && (
          <Button 
            onClick={onRequestOverride} 
            variant="outline" 
            size="sm"
            className="w-full"
          >
            Request Override
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default QuotaStatusWidget;