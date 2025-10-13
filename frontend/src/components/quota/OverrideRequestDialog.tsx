"use client";

import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Clock,
  Unlock,
  Zap,
  AlertTriangle,
  CheckCircle,
  User,
  Home,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OverrideRequest {
  type: 'ADD_TIME' | 'UNLOCK_DAY' | 'EMERGENCY_OVERRIDE';
  additionalSeconds?: number;
  reason: string;
}

export interface QuotaInfo {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  roomName: string;
  quotaType: 'TIME_BASED' | 'SESSION_BASED';
  allowedAmount: number;
  usedAmount: number;
  status: 'EXCEEDED' | 'WARNING';
}

export interface OverrideRequestDialogProps {
  /** The quota that needs an override */
  quota: QuotaInfo;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Whether the request is being processed */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Success message */
  success?: string;
  /** Callback when override is requested */
  onRequestOverride: (request: OverrideRequest) => Promise<void>;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Trigger element for the dialog */
  children?: React.ReactNode;
}

export const OverrideRequestDialog: React.FC<OverrideRequestDialogProps> = React.memo(({
  quota,
  isOpen,
  isLoading = false,
  error,
  success,
  onRequestOverride,
  onClose,
  children
}) => {
  const [overrideType, setOverrideType] = useState<OverrideRequest['type']>('ADD_TIME');
  const [additionalMinutes, setAdditionalMinutes] = useState<number>(30);
  const [reason, setReason] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setOverrideType('ADD_TIME');
    setAdditionalMinutes(30);
    setReason('');
    setValidationErrors({});
  }, []);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!reason.trim()) {
      errors.reason = 'Please provide a reason for the override';
    } else if (reason.trim().length < 10) {
      errors.reason = 'Reason must be at least 10 characters';
    }

    if (overrideType === 'ADD_TIME' && (!additionalMinutes || additionalMinutes < 5)) {
      errors.additionalMinutes = 'Additional time must be at least 5 minutes';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [overrideType, additionalMinutes, reason]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const request: OverrideRequest = {
      type: overrideType,
      reason: reason.trim()
    };

    if (overrideType === 'ADD_TIME') {
      request.additionalSeconds = additionalMinutes * 60;
    }

    try {
      await onRequestOverride(request);
      if (!error) {
        resetForm();
        onClose();
      }
    } catch {
      // Error handling is done in parent component
    }
  }, [overrideType, additionalMinutes, reason, validateForm, onRequestOverride, onClose, resetForm, error]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onClose();
      resetForm();
    }
  }, [onClose, resetForm]);

  const getOverrideDescription = useCallback(() => {
    switch (overrideType) {
      case 'ADD_TIME':
        return `Grant ${additionalMinutes} additional minutes for today`;
      case 'UNLOCK_DAY':
        return 'Reset usage counter to allow continued use today';
      case 'EMERGENCY_OVERRIDE':
        return 'Temporarily disable quota enforcement for emergency use';
      default:
        return '';
    }
  }, [overrideType, additionalMinutes]);

  const getOverrideIcon = useCallback(() => {
    switch (overrideType) {
      case 'ADD_TIME': return <Clock className="h-4 w-4" />;
      case 'UNLOCK_DAY': return <Unlock className="h-4 w-4" />;
      case 'EMERGENCY_OVERRIDE': return <Zap className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  }, [overrideType]);

  const formatUsageAmount = useCallback((amount: number, type: 'TIME_BASED' | 'SESSION_BASED') => {
    if (type === 'TIME_BASED') {
      const hours = Math.floor(amount / 60);
      const minutes = amount % 60;
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    return `${amount} sessions`;
  }, []);

  const usagePercentage = quota.allowedAmount > 0
    ? Math.min((quota.usedAmount / quota.allowedAmount) * 100, 100)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Request Quota Override
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quota Information */}
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Quota Details</h4>
              <Badge variant={quota.status === 'EXCEEDED' ? 'destructive' : 'secondary'}>
                {quota.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3" />
                <span>{quota.userName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Home className="h-3 w-3" />
                <span>{quota.roomName}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Usage</span>
                <span className="font-medium">
                  {Math.round(usagePercentage)}% ({formatUsageAmount(quota.usedAmount, quota.quotaType)} / {formatUsageAmount(quota.allowedAmount, quota.quotaType)})
                </span>
              </div>
            </div>
          </div>

          {/* Alert Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Override Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Override Type Selection */}
            <div className="space-y-3">
              <Label>Override Type</Label>
              <Select
                value={overrideType}
                onValueChange={(value: OverrideRequest['type']) => setOverrideType(value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADD_TIME">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Add Time</div>
                        <div className="text-xs text-muted-foreground">
                          Grant additional usage time for today
                        </div>
                      </div>
                    </div>
                  </SelectItem>

                  <SelectItem value="UNLOCK_DAY">
                    <div className="flex items-center gap-2">
                      <Unlock className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Unlock Day</div>
                        <div className="text-xs text-muted-foreground">
                          Reset usage counter for today
                        </div>
                      </div>
                    </div>
                  </SelectItem>

                  <SelectItem value="EMERGENCY_OVERRIDE">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Emergency Override</div>
                        <div className="text-xs text-muted-foreground">
                          Temporarily disable quota enforcement
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Additional Time Selector (for ADD_TIME type) */}
            {overrideType === 'ADD_TIME' && (
              <div className="space-y-4">
                <Label>Additional Time</Label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">5 minutes</span>
                    <span className="text-lg font-semibold text-primary">
                      {additionalMinutes} minutes
                    </span>
                    <span className="text-sm text-muted-foreground">240 minutes</span>
                  </div>

                  <Slider
                    value={[additionalMinutes]}
                    onValueChange={([value]) => setAdditionalMinutes(value)}
                    min={5}
                    max={240}
                    step={5}
                    className="w-full"
                    disabled={isLoading}
                  />
                </div>

                {validationErrors.additionalMinutes && (
                  <p className="text-sm text-red-600">{validationErrors.additionalMinutes}</p>
                )}
              </div>
            )}

            {/* Reason Input */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for Override
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Please provide a detailed reason for this override request..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isLoading}
                className={cn(
                  "min-h-[80px]",
                  validationErrors.reason && "border-red-500"
                )}
              />
              <p className="text-xs text-muted-foreground">
                {reason.length}/200 characters (minimum 10 required)
              </p>
              {validationErrors.reason && (
                <p className="text-sm text-red-600">{validationErrors.reason}</p>
              )}
            </div>

            <Separator />

            {/* Preview */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="flex items-start gap-2">
                {getOverrideIcon()}
                <div className="space-y-1">
                  <p className="font-medium text-sm">Override Summary</p>
                  <p className="text-sm text-muted-foreground">
                    {getOverrideDescription()}
                  </p>
                  {reason && (
                    <p className="text-xs text-muted-foreground">
                      <strong>Reason:</strong> {reason}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    {getOverrideIcon()}
                    <span className="ml-2">Grant Override</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
});

OverrideRequestDialog.displayName = 'OverrideRequestDialog';

export default OverrideRequestDialog;