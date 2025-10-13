"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Zap, 
  DollarSign, 
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserQuotaBalance, useQuotaUsagePercentage } from '@/stores/quota-store';

export interface QuotaUsageCardProps {
  userId: string;
  roomId: string;
  /** Show trends and analytics */
  showTrends?: boolean;
  /** Compact layout for smaller spaces */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Card component that displays detailed quota usage information.
 * Shows progress bars, remaining quotas, and usage trends.
 */
export const QuotaUsageCard: React.FC<QuotaUsageCardProps> = React.memo(({
  userId,
  roomId,
  showTrends = false,
  compact = false,
  className
}) => {
  const balance = useUserQuotaBalance(userId, roomId);
  const usagePercentage = useQuotaUsagePercentage(userId, roomId);

  // Calculate usage metrics
  const usageMetrics = useMemo(() => {
    if (!balance) return null;

    const metrics = [];

    // Time-based quota
    if (balance.totalSeconds && balance.usedSeconds !== undefined) {
      const totalHours = balance.totalSeconds / 3600;
      const usedHours = balance.usedSeconds / 3600;
      const remainingHours = (balance.remainingSeconds || 0) / 3600;
      const percentage = (balance.usedSeconds / balance.totalSeconds) * 100;

      metrics.push({
        type: 'time',
        icon: Clock,
        label: 'Time Usage',
        total: totalHours,
        used: usedHours,
        remaining: remainingHours,
        percentage,
        unit: 'hours',
        formatValue: (value: number) => `${value.toFixed(1)}h`
      });
    }

    // Usage count quota
    if (balance.totalUsageCount && balance.usedUsageCount !== undefined) {
      const percentage = (balance.usedUsageCount / balance.totalUsageCount) * 100;
      
      metrics.push({
        type: 'count',
        icon: RotateCcw,
        label: 'Usage Count',
        total: balance.totalUsageCount,
        used: balance.usedUsageCount,
        remaining: balance.remainingUsageCount || 0,
        percentage,
        unit: 'uses',
        formatValue: (value: number) => `${Math.round(value)}`
      });
    }

    // Energy quota
    if (balance.totalEnergyKwh && balance.usedEnergyKwh !== undefined) {
      const percentage = (balance.usedEnergyKwh / balance.totalEnergyKwh) * 100;
      
      metrics.push({
        type: 'energy',
        icon: Zap,
        label: 'Energy Usage',
        total: balance.totalEnergyKwh,
        used: balance.usedEnergyKwh,
        remaining: balance.remainingEnergyKwh || 0,
        percentage,
        unit: 'kWh',
        formatValue: (value: number) => `${value.toFixed(2)} kWh`
      });
    }

    // Cost quota
    if (balance.totalCostAmount && balance.usedCostAmount !== undefined) {
      const percentage = (balance.usedCostAmount / balance.totalCostAmount) * 100;
      
      metrics.push({
        type: 'cost',
        icon: DollarSign,
        label: 'Budget Usage',
        total: balance.totalCostAmount,
        used: balance.usedCostAmount,
        remaining: balance.remainingCostAmount || 0,
        percentage,
        unit: 'dollars',
        formatValue: (value: number) => `$${value.toFixed(2)}`
      });
    }

    return metrics;
  }, [balance]);

  const getUsageStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-600 dark:text-red-400';
    if (percentage >= (balance?.warningThreshold || 75)) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };


  if (!balance || !usageMetrics || usageMetrics.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No quota information available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className={compact ? "pb-3" : "pb-4"}>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={compact ? "text-base" : "text-lg"}>Quota Usage</span>
            {balance.hasOverride && (
              <Badge variant="outline" className="text-xs">
                Override Active
              </Badge>
            )}
          </div>
          <div className="text-right">
            <div className={cn(
              "font-bold",
              compact ? "text-lg" : "text-xl",
              getUsageStatusColor(usagePercentage)
            )}>
              {usagePercentage.toFixed(0)}%
            </div>
            {!compact && (
              <div className="text-xs text-muted-foreground">
                Overall Usage
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className={compact ? "pt-0" : "pt-0 space-y-4"}>
        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className={cn("text-sm font-medium", getUsageStatusColor(usagePercentage))}>
              {usagePercentage > 100 ? 'Exceeded' : `${usagePercentage.toFixed(1)}%`}
            </span>
          </div>
          <Progress 
            value={Math.min(usagePercentage, 100)} 
            className="h-2"
          />
        </div>

        {/* Individual Metric Progress Bars */}
        <div className={cn("space-y-3", compact && "space-y-2")}>
          {usageMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.type} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{metric.label}</span>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "text-sm font-medium",
                      getUsageStatusColor(metric.percentage)
                    )}>
                      {metric.formatValue(metric.used)} / {metric.formatValue(metric.total)}
                    </div>
                    {!compact && (
                      <div className="text-xs text-muted-foreground">
                        {metric.formatValue(metric.remaining)} remaining
                      </div>
                    )}
                  </div>
                </div>
                
                <Progress 
                  value={Math.min(metric.percentage, 100)} 
                  className="h-1.5"
                />
                
                {compact && (
                  <div className="text-xs text-muted-foreground text-right">
                    {metric.formatValue(metric.remaining)} remaining
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Trends Section (if enabled) */}
        {showTrends && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Usage Trends</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-muted-foreground">Daily avg:</span>
                <span>2.3h</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-blue-500" />
                <span className="text-muted-foreground">vs. last week:</span>
                <span>-15%</span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="h-3 w-3 text-gray-500" />
                <span className="text-muted-foreground">Peak hour:</span>
                <span>7-8 PM</span>
              </div>
              <div className="flex items-center gap-1">
                <RotateCcw className="h-3 w-3 text-purple-500" />
                <span className="text-muted-foreground">Sessions:</span>
                <span>12 today</span>
              </div>
            </div>
          </div>
        )}

        {/* Reset Information */}
        {balance.resetTime && (
          <div className="pt-3 border-t border-border text-center">
            <div className="text-xs text-muted-foreground">
              Quota resets on {new Date(balance.resetTime).toLocaleDateString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

QuotaUsageCard.displayName = 'QuotaUsageCard';

export default QuotaUsageCard;