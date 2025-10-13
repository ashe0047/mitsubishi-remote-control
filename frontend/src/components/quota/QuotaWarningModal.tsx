"use client";

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  XCircle,
  Shield,
  Clock,
  Zap,
  DollarSign,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  useUserQuotaBalance, 
  useUserViolations, 
  useQuotaOverrideRequest,
  useQuotaUsagePercentage
} from '@/stores/quota-store';

export interface QuotaWarningModalProps {
  userId: string;
  roomId: string;
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Whether to allow override requests */
  allowOverrideRequest?: boolean;
  /** Custom modal size */
  size?: 'sm' | 'default' | 'lg';
}

/**
 * Modal dialog that displays quota warnings, violations, and allows override requests.
 * Shows current usage status and provides options for users to request quota overrides.
 */
export const QuotaWarningModal: React.FC<QuotaWarningModalProps> = React.memo(({
  userId,
  roomId,
  open,
  onClose,
  allowOverrideRequest = true,
  size = 'default'
}) => {
  const [overrideReason, setOverrideReason] = useState('');
  const [additionalTime, setAdditionalTime] = useState<number>(30); // Default 30 minutes
  
  const balance = useUserQuotaBalance(userId, roomId);
  const violations = useUserViolations(userId);
  const usagePercentage = useQuotaUsagePercentage(userId, roomId);
  const { requestOverride, isRequesting, error } = useQuotaOverrideRequest();
  
  // Filter violations for this room
  const roomViolations = violations.filter(v => v.roomId === roomId);
  const activeViolation = roomViolations.find(v => 
    v.type === 'EXCEEDED' || v.type === 'BLOCKED'
  ) || roomViolations[0];

  const handleOverrideRequest = useCallback(async (type: 'ADD_TIME' | 'UNLOCK_DAY' | 'EMERGENCY_OVERRIDE') => {
    if (!balance) return;

    try {
      const additionalSeconds = type === 'ADD_TIME' ? additionalTime * 60 : undefined;
      const reason = overrideReason.trim() || `${type.toLowerCase().replace('_', ' ')} request`;
      
      await requestOverride(userId, roomId, type, additionalSeconds, reason);
      
      // Reset form and close modal on success
      setOverrideReason('');
      setAdditionalTime(30);
      onClose();
    } catch (err) {
      console.error('Override request failed:', err);
      // Error is already set in the store
    }
  }, [balance, additionalTime, overrideReason, requestOverride, userId, roomId, onClose]);

  if (!balance) {
    return null;
  }

  // Determine the severity and messaging based on usage and violations
  const getSeverityInfo = () => {
    if (activeViolation?.type === 'BLOCKED') {
      return {
        severity: 'critical' as const,
        icon: XCircle,
        title: 'Access Blocked',
        description: 'Your quota has been exceeded and access is currently blocked.',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-950/20',
        borderColor: 'border-red-200 dark:border-red-800'
      };
    }
    
    if (activeViolation?.type === 'EXCEEDED') {
      return {
        severity: 'high' as const,
        icon: AlertTriangle,
        title: 'Quota Exceeded',
        description: 'You have exceeded your allocated quota for this room.',
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-950/20',
        borderColor: 'border-orange-200 dark:border-orange-800'
      };
    }
    
    if (usagePercentage >= balance.warningThreshold) {
      return {
        severity: 'medium' as const,
        icon: AlertTriangle,
        title: 'Quota Warning',
        description: `You have used ${usagePercentage.toFixed(1)}% of your quota allocation.`,
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800'
      };
    }
    
    return {
      severity: 'low' as const,
      icon: Shield,
      title: 'Quota Status',
      description: 'Your current quota usage and status information.',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800'
    };
  };

  const severityInfo = getSeverityInfo();
  const Icon = severityInfo.icon;

  // Format quota details for display
  const getQuotaDetails = () => {
    const details = [];
    
    if (balance.totalSeconds) {
      const totalHours = balance.totalSeconds / 3600;
      const usedHours = (balance.usedSeconds || 0) / 3600;
      const remainingHours = (balance.remainingSeconds || 0) / 3600;
      
      details.push({
        icon: Clock,
        label: 'Time Quota',
        total: `${totalHours.toFixed(1)}h`,
        used: `${usedHours.toFixed(1)}h`,
        remaining: `${remainingHours.toFixed(1)}h`,
        percentage: ((balance.usedSeconds || 0) / balance.totalSeconds) * 100
      });
    }
    
    if (balance.totalUsageCount) {
      details.push({
        icon: RotateCcw,
        label: 'Usage Count',
        total: `${balance.totalUsageCount}`,
        used: `${balance.usedUsageCount || 0}`,
        remaining: `${balance.remainingUsageCount || 0}`,
        percentage: ((balance.usedUsageCount || 0) / balance.totalUsageCount) * 100
      });
    }
    
    if (balance.totalEnergyKwh) {
      details.push({
        icon: Zap,
        label: 'Energy Quota',
        total: `${balance.totalEnergyKwh} kWh`,
        used: `${(balance.usedEnergyKwh || 0).toFixed(2)} kWh`,
        remaining: `${(balance.remainingEnergyKwh || 0).toFixed(2)} kWh`,
        percentage: ((balance.usedEnergyKwh || 0) / balance.totalEnergyKwh) * 100
      });
    }
    
    if (balance.totalCostAmount) {
      details.push({
        icon: DollarSign,
        label: 'Budget Quota',
        total: `$${balance.totalCostAmount.toFixed(2)}`,
        used: `$${(balance.usedCostAmount || 0).toFixed(2)}`,
        remaining: `$${(balance.remainingCostAmount || 0).toFixed(2)}`,
        percentage: ((balance.usedCostAmount || 0) / balance.totalCostAmount) * 100
      });
    }
    
    return details;
  };

  const quotaDetails = getQuotaDetails();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className={cn(
          "sm:max-w-md",
          size === 'lg' && "sm:max-w-2xl",
          size === 'sm' && "sm:max-w-sm"
        )}
        onInteractOutside={(e) => {
          // Prevent closing when clicking outside for critical violations
          if (severityInfo.severity === 'critical') {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", severityInfo.color)} />
            {severityInfo.title}
          </DialogTitle>
          <DialogDescription>
            {severityInfo.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quota Usage Overview */}
          <div className={cn(
            "p-4 rounded-lg border",
            severityInfo.bgColor,
            severityInfo.borderColor
          )}>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Overall Usage</span>
                <Badge 
                  variant={usagePercentage >= 100 ? "destructive" : usagePercentage >= balance.warningThreshold ? "secondary" : "default"}
                  className="text-xs"
                >
                  {usagePercentage.toFixed(1)}%
                </Badge>
              </div>
              <Progress 
                value={Math.min(usagePercentage, 100)} 
                className="h-2"
              />
            </div>
          </div>

          {/* Detailed Quota Breakdown */}
          {quotaDetails.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Quota Details</h4>
              {quotaDetails.map((detail, index) => {
                const DetailIcon = detail.icon;
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <DetailIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{detail.label}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {detail.used} / {detail.total}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {detail.remaining} remaining
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Violations */}
          {activeViolation && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Current Issue</h4>
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{activeViolation.message}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(activeViolation.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Override Request Form */}
          {allowOverrideRequest && (severityInfo.severity === 'high' || severityInfo.severity === 'critical') && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Request Override</h4>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="reason" className="text-sm">
                    Reason for Override Request
                  </Label>
                  <Textarea
                    id="reason"
                    placeholder="Please explain why you need additional quota access..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                
                {balance.totalSeconds && (
                  <div>
                    <Label htmlFor="additionalTime" className="text-sm">
                      Additional Time (minutes)
                    </Label>
                    <input
                      id="additionalTime"
                      type="number"
                      min="5"
                      max="240"
                      step="5"
                      value={additionalTime}
                      onChange={(e) => setAdditionalTime(parseInt(e.target.value) || 30)}
                      className="mt-1 w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                )}
                
                {error && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {allowOverrideRequest && (severityInfo.severity === 'high' || severityInfo.severity === 'critical') && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOverrideRequest('ADD_TIME')}
                disabled={isRequesting}
                className="flex-1 sm:flex-none"
              >
                {isRequesting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Request Time
              </Button>
              
              {severityInfo.severity === 'critical' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleOverrideRequest('EMERGENCY_OVERRIDE')}
                  disabled={isRequesting}
                  className="flex-1 sm:flex-none"
                >
                  {isRequesting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Emergency
                </Button>
              )}
            </div>
          )}
          
          <Button
            variant={severityInfo.severity === 'critical' ? 'secondary' : 'default'}
            onClick={onClose}
            disabled={isRequesting}
            className="w-full sm:w-auto"
          >
            {severityInfo.severity === 'critical' ? 'Acknowledge' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

QuotaWarningModal.displayName = 'QuotaWarningModal';

export default QuotaWarningModal;