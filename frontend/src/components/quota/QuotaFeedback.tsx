"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, XCircle, CheckCircle, Clock, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuotaValidationResult } from '@/lib/api/quota-api-factory';

export interface QuotaFeedbackProps {
  validationResult: QuotaValidationResult | null;
  onDismiss?: () => void;
  className?: string;
}

/**
 * QuotaFeedback component displays quota validation results to users.
 *
 * This component shows different UI states based on quota validation:
 * - ALLOW: Success state (green)
 * - ALLOW_WITH_WARNING: Warning state (yellow/orange)
 * - BLOCK: Error state (red)
 * - FAIL_OPEN: Info state (blue)
 */
export const QuotaFeedback: React.FC<QuotaFeedbackProps> = React.memo(({
  validationResult,
  onDismiss,
  className
}) => {
  if (!validationResult) {
    return null;
  }

  const { status, message, reason, quotaUsage } = validationResult;

  // Determine alert variant and icon based on status
  const getAlertConfig = () => {
    switch (status) {
      case 'ALLOW':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          iconColor: 'text-green-600 dark:text-green-400',
          badgeVariant: 'default' as const,
          title: 'Command Allowed'
        };
      case 'ALLOW_WITH_WARNING':
        return {
          variant: 'destructive' as const,
          icon: AlertTriangle,
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          badgeVariant: 'secondary' as const,
          title: 'Quota Warning'
        };
      case 'BLOCK':
        return {
          variant: 'destructive' as const,
          icon: XCircle,
          iconColor: 'text-red-600 dark:text-red-400',
          badgeVariant: 'destructive' as const,
          title: 'Command Blocked'
        };
      case 'FAIL_OPEN':
        return {
          variant: 'default' as const,
          icon: Info,
          iconColor: 'text-blue-600 dark:text-blue-400',
          badgeVariant: 'outline' as const,
          title: 'Quota Service Unavailable'
        };
      default:
        return {
          variant: 'default' as const,
          icon: Info,
          iconColor: 'text-gray-600 dark:text-gray-400',
          badgeVariant: 'outline' as const,
          title: 'Unknown Status'
        };
    }
  };

  const config = getAlertConfig();
  const IconComponent = config.icon;

  // Format quota usage information
  const formatQuotaUsage = () => {
    if (!quotaUsage) return null;

    const {
      currentUsage,
      dailyLimit,
      remainingUsage,
      usagePercentage
    } = quotaUsage;

    if (currentUsage !== undefined && dailyLimit !== undefined) {
      const hours = Math.floor(currentUsage / 3600);
      const minutes = Math.floor((currentUsage % 3600) / 60);
      const totalHours = Math.floor(dailyLimit / 3600);
      const totalMinutes = Math.floor((dailyLimit % 3600) / 60);

      return (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Usage Today:</span>
            <span className="font-medium">
              {hours}h {minutes}m / {totalHours}h {totalMinutes}m
            </span>
          </div>

          {usagePercentage !== undefined && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    usagePercentage >= 90 ? "bg-red-500" :
                    usagePercentage >= 75 ? "bg-yellow-500" :
                    "bg-green-500"
                  )}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium min-w-[3rem] text-right">
                {usagePercentage.toFixed(0)}%
              </span>
            </div>
          )}

          {remainingUsage !== undefined && remainingUsage > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {Math.floor(remainingUsage / 3600)}h {Math.floor((remainingUsage % 3600) / 60)}m remaining
              </span>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={cn("w-full", className)}
      >
        <Alert variant={config.variant} className="border-l-4">
          <div className="flex items-start gap-3">
            <IconComponent className={cn("h-5 w-5 mt-0.5", config.iconColor)} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <AlertTitle className="text-sm font-semibold">
                  {config.title}
                </AlertTitle>
                <Badge variant={config.badgeVariant} className="text-xs">
                  {status.replace('_', ' ')}
                </Badge>
              </div>

              <AlertDescription className="text-sm space-y-2">
                <p>{message}</p>
                {reason && reason !== message && (
                  <p className="text-xs text-muted-foreground italic">
                    {reason}
                  </p>
                )}
                {formatQuotaUsage()}
              </AlertDescription>
            </div>

            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                aria-label="Dismiss"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
});

QuotaFeedback.displayName = 'QuotaFeedback';

export default QuotaFeedback;