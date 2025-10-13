"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  Clock,
  Unlock,
  Zap,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

import OverrideRequestDialog, { OverrideRequest, QuotaInfo } from './OverrideRequestDialog';

export interface QuickOverrideButtonProps {
  /** Current quota information */
  quota: QuotaInfo;
  /** Whether user has permission to request overrides */
  canRequestOverride?: boolean;
  /** Whether override request is being processed */
  isLoading?: boolean;
  /** Callback when override is requested */
  onRequestOverride: (request: OverrideRequest) => Promise<void>;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
  /** Button size */
  size?: 'sm' | 'default' | 'lg';
  /** Show quota status in button */
  showStatus?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const QuickOverrideButton: React.FC<QuickOverrideButtonProps> = React.memo(({
  quota,
  canRequestOverride = false,
  isLoading = false,
  onRequestOverride,
  variant = 'outline',
  size = 'default',
  showStatus = true,
  className
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState<string>('');

  const handleRequestOverride = useCallback(async (request: OverrideRequest) => {
    setRequestError('');
    setRequestSuccess(false);

    try {
      await onRequestOverride(request);
      setRequestSuccess(true);
      setTimeout(() => setRequestSuccess(false), 3000); // Clear success after 3s
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request override';
      setRequestError(errorMessage);
      setTimeout(() => setRequestError(''), 5000); // Clear error after 5s
      throw error; // Re-throw to let dialog handle it
    }
  }, [onRequestOverride]);

  const getQuotaStatusInfo = useCallback(() => {
    const usagePercentage = quota.allowedAmount > 0
      ? (quota.usedAmount / quota.allowedAmount) * 100
      : 0;

    if (quota.status === 'EXCEEDED') {
      return {
        text: 'Quota Exceeded',
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-950/20',
        icon: <AlertTriangle className="h-3 w-3" />
      };
    }

    if (usagePercentage >= 90) {
      return {
        text: 'Near Limit',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 dark:bg-amber-950/20',
        icon: <AlertTriangle className="h-3 w-3" />
      };
    }

    return {
      text: 'Normal',
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      icon: <CheckCircle className="h-3 w-3" />
    };
  }, [quota]);

  const statusInfo = getQuotaStatusInfo();
  const needsOverride = quota.status === 'EXCEEDED';

  // Don't show button if user can't request overrides and quota is not exceeded
  if (!canRequestOverride && !needsOverride) {
    return null;
  }

  // Show alert if quota is exceeded but user can't request override
  if (needsOverride && !canRequestOverride) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Quota exceeded. Contact a parent for override.</span>
          <Badge variant="destructive">
            Blocked
          </Badge>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Success/Error Messages */}
      {requestSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            Override request submitted successfully!
          </AlertDescription>
        </Alert>
      )}

      {requestError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      {/* Override Button */}
      <OverrideRequestDialog
        quota={quota}
        isOpen={dialogOpen}
        isLoading={isLoading}
        onRequestOverride={handleRequestOverride}
        onClose={() => setDialogOpen(false)}
      >
        <Button
          variant={needsOverride ? 'default' : variant}
          size={size}
          disabled={isLoading}
          className={cn(
            "w-full flex items-center justify-between",
            needsOverride && "border-red-200 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30"
          )}
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>
              {needsOverride ? 'Request Override' : 'Override Available'}
            </span>
          </div>

          {showStatus && (
            <Badge
              variant="outline"
              className={cn(
                "ml-2 text-xs",
                statusInfo.color,
                statusInfo.bgColor
              )}
            >
              <span className="flex items-center gap-1">
                {statusInfo.icon}
                {statusInfo.text}
              </span>
            </Badge>
          )}
        </Button>
      </OverrideRequestDialog>

      {/* Quick Override Options (for exceeded quotas) */}
      {needsOverride && canRequestOverride && (
        <div className="grid grid-cols-3 gap-2">
          <OverrideRequestDialog
            quota={quota}
            isOpen={false}
            onRequestOverride={handleRequestOverride}
            onClose={() => {}}
          >
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs"
              disabled={isLoading}
            >
              <Clock className="h-3 w-3" />
              +30min
            </Button>
          </OverrideRequestDialog>

          <OverrideRequestDialog
            quota={quota}
            isOpen={false}
            onRequestOverride={handleRequestOverride}
            onClose={() => {}}
          >
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs"
              disabled={isLoading}
            >
              <Unlock className="h-3 w-3" />
              Reset
            </Button>
          </OverrideRequestDialog>

          <OverrideRequestDialog
            quota={quota}
            isOpen={false}
            onRequestOverride={handleRequestOverride}
            onClose={() => {}}
          >
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs"
              disabled={isLoading}
            >
              <Zap className="h-3 w-3" />
              Emergency
            </Button>
          </OverrideRequestDialog>
        </div>
      )}

      {/* Usage Info */}
      {showStatus && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Today&apos;s Usage:</span>
            <span>
              {quota.quotaType === 'TIME_BASED'
                ? `${Math.round(quota.usedAmount)}m / ${Math.round(quota.allowedAmount)}m`
                : `${quota.usedAmount} / ${quota.allowedAmount} sessions`
              }
            </span>
          </div>
          <div className="flex justify-between">
            <span>User:</span>
            <span>{quota.userName}</span>
          </div>
          <div className="flex justify-between">
            <span>Room:</span>
            <span>{quota.roomName}</span>
          </div>
        </div>
      )}
    </div>
  );
});

QuickOverrideButton.displayName = 'QuickOverrideButton';

export default QuickOverrideButton;