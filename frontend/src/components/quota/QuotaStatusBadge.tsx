"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Clock, 
  Zap, 
  DollarSign, 
  RotateCcw, 
  AlertTriangle, 
  XCircle, 
  CheckCircle,
  Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserQuotaBalance, useQuotaUsagePercentage } from '@/stores/quota-store';

export interface QuotaStatusBadgeProps {
  userId: string;
  roomId: string;
  /** Show detailed tooltip with breakdown */
  showTooltip?: boolean;
  /** Size variant for the badge */
  size?: 'sm' | 'default' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Quota status badge component that displays current quota usage and status.
 * Shows different colors and icons based on usage level and violations.
 */
export const QuotaStatusBadge: React.FC<QuotaStatusBadgeProps> = React.memo(({
  userId,
  roomId,
  showTooltip = true,
  size = 'default',
  className
}) => {
  const balance = useUserQuotaBalance(userId, roomId);
  const usagePercentage = useQuotaUsagePercentage(userId, roomId);

  if (!balance) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "flex items-center gap-1",
          size === 'sm' && "text-xs px-2 py-0.5",
          size === 'lg' && "text-sm px-3 py-1",
          className
        )}
      >
        <Timer className="h-3 w-3" />
        No Quota
      </Badge>
    );
  }

  // Determine status based on usage and violations
  const getStatusInfo = () => {
    if (balance.isExceeded) {
      return {
        variant: 'destructive' as const,
        icon: XCircle,
        text: 'Exceeded',
        color: 'text-red-600 dark:text-red-400'
      };
    }
    
    if (usagePercentage >= balance.warningThreshold) {
      return {
        variant: 'secondary' as const,
        icon: AlertTriangle,
        text: 'Warning',
        color: 'text-yellow-600 dark:text-yellow-400'
      };
    }
    
    if (balance.hasOverride) {
      return {
        variant: 'outline' as const,
        icon: RotateCcw,
        text: 'Override',
        color: 'text-blue-600 dark:text-blue-400'
      };
    }
    
    return {
      variant: 'default' as const,
      icon: CheckCircle,
      text: 'Healthy',
      color: 'text-green-600 dark:text-green-400'
    };
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  // Format the primary quota type for display
  const formatQuotaDisplay = () => {
    if (balance.totalSeconds && balance.remainingSeconds !== undefined) {
      const hours = Math.floor(balance.remainingSeconds / 3600);
      const minutes = Math.floor((balance.remainingSeconds % 3600) / 60);
      return {
        icon: Clock,
        text: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
        label: 'Time Remaining'
      };
    }
    
    if (balance.totalUsageCount && balance.remainingUsageCount !== undefined) {
      return {
        icon: RotateCcw,
        text: `${balance.remainingUsageCount} uses`,
        label: 'Uses Remaining'
      };
    }
    
    if (balance.totalEnergyKwh && balance.remainingEnergyKwh !== undefined) {
      return {
        icon: Zap,
        text: `${balance.remainingEnergyKwh.toFixed(1)} kWh`,
        label: 'Energy Remaining'
      };
    }
    
    if (balance.totalCostAmount && balance.remainingCostAmount !== undefined) {
      return {
        icon: DollarSign,
        text: `$${balance.remainingCostAmount.toFixed(2)}`,
        label: 'Budget Remaining'
      };
    }
    
    return {
      icon: Timer,
      text: `${usagePercentage.toFixed(0)}%`,
      label: 'Usage'
    };
  };

  const quotaDisplay = formatQuotaDisplay();
  const QuotaIcon = quotaDisplay.icon;

  const badgeContent = (
    <Badge 
      variant={statusInfo.variant}
      className={cn(
        "flex items-center gap-1 font-medium",
        size === 'sm' && "text-xs px-2 py-0.5",
        size === 'lg' && "text-sm px-3 py-1",
        statusInfo.color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <QuotaIcon className="h-3 w-3" />
      {quotaDisplay.text}
    </Badge>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  // Detailed tooltip content
  const tooltipContent = (
    <div className="space-y-2 text-sm">
      <div className="font-semibold flex items-center gap-2">
        <Icon className="h-4 w-4" />
        Quota Status: {statusInfo.text}
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Usage:</span>
          <span className="font-medium">{usagePercentage.toFixed(1)}%</span>
        </div>
        
        {balance.totalSeconds && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Time Limit:</span>
            <span className="font-medium">
              {Math.floor(balance.totalSeconds / 3600)}h {Math.floor((balance.totalSeconds % 3600) / 60)}m
            </span>
          </div>
        )}
        
        {balance.remainingSeconds !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Remaining:</span>
            <span className="font-medium">
              {Math.floor(balance.remainingSeconds / 3600)}h {Math.floor((balance.remainingSeconds % 3600) / 60)}m
            </span>
          </div>
        )}
        
        {balance.totalUsageCount && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Usage Limit:</span>
            <span className="font-medium">{balance.totalUsageCount} times</span>
          </div>
        )}
        
        {balance.remainingUsageCount !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Uses Left:</span>
            <span className="font-medium">{balance.remainingUsageCount}</span>
          </div>
        )}
        
        {balance.totalEnergyKwh && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Energy Limit:</span>
            <span className="font-medium">{balance.totalEnergyKwh} kWh</span>
          </div>
        )}
        
        {balance.remainingEnergyKwh !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Energy Left:</span>
            <span className="font-medium">{balance.remainingEnergyKwh.toFixed(2)} kWh</span>
          </div>
        )}
        
        {balance.totalCostAmount && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Budget:</span>
            <span className="font-medium">${balance.totalCostAmount.toFixed(2)}</span>
          </div>
        )}
        
        {balance.remainingCostAmount !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Budget Left:</span>
            <span className="font-medium">${balance.remainingCostAmount.toFixed(2)}</span>
          </div>
        )}
      </div>
      
      {balance.resetTime && (
        <div className="pt-1 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Resets:</span>
            <span className="font-medium text-xs">
              {new Date(balance.resetTime).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
      
      {balance.hasOverride && (
        <div className="pt-1 border-t border-border text-blue-600 dark:text-blue-400">
          <div className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />
            <span className="text-xs font-medium">Override Active</span>
          </div>
        </div>
      )}
      
      <div className="pt-1 text-xs text-muted-foreground">
        Last updated: {new Date(balance.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badgeContent}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
});

QuotaStatusBadge.displayName = 'QuotaStatusBadge';

export default QuotaStatusBadge;