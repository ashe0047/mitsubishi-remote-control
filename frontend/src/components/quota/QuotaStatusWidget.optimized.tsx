"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Activity, 
  Zap, 
  DollarSign, 
  AlertTriangle, 
  User, 
  Home,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuotaStatusWidgetProps {
  quotaId: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  quotaType: 'TIME_BASED' | 'USAGE_BASED' | 'ENERGY_BASED' | 'COST_BASED';
  currentUsage: number;
  dailyLimit: number;
  status: 'ACTIVE' | 'WARNING' | 'EXCEEDED' | 'PAUSED';
  warningThreshold: number;
  resetTime?: string;
  showOverrideButton?: boolean;
  onOverrideClick?: () => void;
  compact?: boolean;
  className?: string;
}

// Memoized icon component to prevent re-renders
const QuotaTypeIcon = React.memo<{ type: QuotaStatusWidgetProps['quotaType'] }>(({ type }) => {
  const IconComponent = useMemo(() => {
    switch (type) {
      case 'TIME_BASED': return Clock;
      case 'USAGE_BASED': return Activity;
      case 'ENERGY_BASED': return Zap;
      case 'COST_BASED': return DollarSign;
      default: return Clock;
    }
  }, [type]);

  return <IconComponent className="h-4 w-4 text-primary" />;
});

QuotaTypeIcon.displayName = 'QuotaTypeIcon';

// Memoized status badge component
const StatusBadge = React.memo<{ 
  status: QuotaStatusWidgetProps['status']; 
  className?: string;
}>(({ status, className }) => {
  const { variant, color, label } = useMemo(() => {
    switch (status) {
      case 'ACTIVE':
        return { variant: 'default' as const, color: 'text-green-600 dark:text-green-400', label: 'Active' };
      case 'WARNING':
        return { variant: 'secondary' as const, color: 'text-yellow-600 dark:text-yellow-400', label: 'Warning' };
      case 'EXCEEDED':
        return { variant: 'destructive' as const, color: 'text-red-600 dark:text-red-400', label: 'Exceeded' };
      case 'PAUSED':
        return { variant: 'outline' as const, color: 'text-gray-600 dark:text-gray-400', label: 'Paused' };
      default:
        return { variant: 'outline' as const, color: 'text-gray-600 dark:text-gray-400', label: status };
    }
  }, [status]);

  return (
    <Badge variant={variant} className={cn(color, className)}>
      {label}
    </Badge>
  );
});

StatusBadge.displayName = 'StatusBadge';

// Memoized usage formatter
const useUsageFormatter = (quotaType: QuotaStatusWidgetProps['quotaType']) => {
  return useCallback((usage: number) => {
    switch (quotaType) {
      case 'TIME_BASED':
        const hours = Math.floor(usage / 3600);
        const minutes = Math.floor((usage % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      case 'USAGE_BASED':
        return `${usage} use${usage !== 1 ? 's' : ''}`;
      case 'ENERGY_BASED':
        return `${(usage / 1000).toFixed(2)} kWh`;
      case 'COST_BASED':
        return `$${usage.toFixed(2)}`;
      default:
        return `${usage}`;
    }
  }, [quotaType]);
};

// Memoized progress calculation
const useProgressCalculation = (currentUsage: number, dailyLimit: number) => {
  return useMemo(() => {
    if (dailyLimit === 0) return 0;
    return Math.min((currentUsage / dailyLimit) * 100, 100);
  }, [currentUsage, dailyLimit]);
};

// Memoized time until reset calculation
const useTimeUntilReset = (resetTime?: string) => {
  return useMemo(() => {
    if (!resetTime) return null;
    
    const reset = new Date(resetTime);
    const now = new Date();
    const diff = reset.getTime() - now.getTime();
    
    if (diff <= 0) return 'Resetting soon';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Resets in ${days}d`;
    } else if (hours > 0) {
      return `Resets in ${hours}h ${minutes}m`;
    } else {
      return `Resets in ${minutes}m`;
    }
  }, [resetTime]);
};

// Main component with comprehensive memoization
export const QuotaStatusWidget: React.FC<QuotaStatusWidgetProps> = React.memo(({
  familyMemberName,
  roomName,
  quotaType,
  currentUsage,
  dailyLimit,
  status,
  warningThreshold,
  resetTime,
  showOverrideButton = false,
  onOverrideClick,
  compact = false,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Memoized calculations and formatters
  const formatUsage = useUsageFormatter(quotaType);
  const usagePercent = useProgressCalculation(currentUsage, dailyLimit);
  const timeUntilReset = useTimeUntilReset(resetTime);

  // Memoized formatted strings to prevent recalculation
  const formattedCurrentUsage = useMemo(() => formatUsage(currentUsage), [formatUsage, currentUsage]);
  const formattedDailyLimit = useMemo(() => formatUsage(dailyLimit), [formatUsage, dailyLimit]);
  
  // Memoized style calculations
  const progressBarStyle = useMemo(() => {
    if (status === 'EXCEEDED') {
      return {
        background: 'linear-gradient(to right, rgb(239 68 68), rgb(220 38 38))'
      };
    }
    return undefined;
  }, [status]);

  const cardClassName = useMemo(() => {
    return cn(
      "transition-all duration-200",
      status === 'EXCEEDED' && "border-red-200 dark:border-red-800",
      status === 'WARNING' && "border-yellow-200 dark:border-yellow-800",
      compact && "max-w-sm",
      className
    );
  }, [status, compact, className]);

  // Memoized event handlers
  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleOverrideClick = useCallback(() => {
    onOverrideClick?.();
  }, [onOverrideClick]);

  // Early return for compact collapsed mode
  if (compact && !isExpanded) {
    return (
      <Card 
        className={cn("cursor-pointer hover:shadow-md", cardClassName)}
        onClick={handleToggleExpand}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <QuotaTypeIcon type={quotaType} />
              <span className="font-medium text-sm">{familyMemberName}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium">{usagePercent.toFixed(0)}%</span>
              <StatusBadge status={status} className="text-xs px-2 py-0.5" />
            </div>
          </div>
          <div className="mt-2">
            <Progress value={usagePercent} className="h-1" style={progressBarStyle} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClassName}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QuotaTypeIcon type={quotaType} />
            <CardTitle className="text-base font-medium">
              {quotaType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Quota
            </CardTitle>
          </div>
          <StatusBadge status={status} />
        </div>
        
        <CardDescription className="flex items-center space-x-4 text-xs">
          <span className="flex items-center space-x-1">
            <User className="h-3 w-3" />
            <span>{familyMemberName}</span>
          </span>
          <span>•</span>
          <span className="flex items-center space-x-1">
            <Home className="h-3 w-3" />
            <span>{roomName}</span>
          </span>
          {timeUntilReset && (
            <>
              <span>•</span>
              <span className="text-muted-foreground">{timeUntilReset}</span>
            </>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Usage</span>
            <span className="font-medium">
              {formattedCurrentUsage} / {formattedDailyLimit}
            </span>
          </div>
          
          <Progress 
            value={usagePercent} 
            className={cn(
              "h-2 transition-all duration-300",
              status === 'EXCEEDED' && "bg-red-100 dark:bg-red-950"
            )}
            style={progressBarStyle}
          />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{usagePercent.toFixed(1)}% used</span>
            {usagePercent >= warningThreshold && status !== 'EXCEEDED' && (
              <div className="flex items-center space-x-1 text-yellow-600">
                <AlertTriangle className="h-3 w-3" />
                <span>Approaching limit</span>
              </div>
            )}
            {status === 'EXCEEDED' && (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertTriangle className="h-3 w-3" />
                <span>Limit exceeded</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {(showOverrideButton || compact) && (
          <div className="flex items-center justify-between">
            {compact && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleToggleExpand}
                className="text-xs"
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
            )}
            
            {showOverrideButton && status === 'EXCEEDED' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleOverrideClick}
                className="text-xs"
              >
                Request Override
              </Button>
            )}
            
            {status === 'PAUSED' && (
              <Button variant="ghost" size="sm" className="text-xs">
                <Play className="mr-1 h-3 w-3" />
                Resume
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

QuotaStatusWidget.displayName = 'QuotaStatusWidget';

export default QuotaStatusWidget;