"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, User, Home, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuotaSetupData {
  userId: string;
  roomId: string;
  quotaType: 'TIME_BASED' | 'SESSION_BASED';
  allowedAmount: number;
  warningThreshold: number;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

export interface QuotaSetupFormProps {
  /** Available users for quota assignment */
  users: Array<{ id: string; name: string; email: string; isChild: boolean }>;
  /** Available rooms for quota scope */
  rooms: Array<{ roomId: string; roomName: string }>;
  /** Initial data for editing existing quota */
  initialData?: Partial<QuotaSetupData>;
  /** Whether the form is in loading state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** Success message to display */
  success?: string;
  /** Callback when form is submitted */
  onSubmit: (data: QuotaSetupData) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export const QuotaSetupForm: React.FC<QuotaSetupFormProps> = React.memo(({
  users,
  rooms,
  initialData,
  isLoading = false,
  error,
  success,
  onSubmit,
  onCancel,
  className
}) => {
  const [formData, setFormData] = useState<QuotaSetupData>({
    userId: initialData?.userId || '',
    roomId: initialData?.roomId || '',
    quotaType: initialData?.quotaType || 'TIME_BASED',
    allowedAmount: initialData?.allowedAmount || 240, // 4 hours default
    warningThreshold: initialData?.warningThreshold || 75,
    effectiveFrom: initialData?.effectiveFrom || new Date().toISOString().split('T')[0],
    effectiveUntil: initialData?.effectiveUntil || ''
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formData.userId) {
      errors.userId = 'Please select a user';
    }

    if (!formData.roomId) {
      errors.roomId = 'Please select a room';
    }

    if (formData.allowedAmount <= 0) {
      errors.allowedAmount = 'Allowed amount must be greater than 0';
    }

    if (formData.quotaType === 'TIME_BASED' && formData.allowedAmount > 1440) {
      errors.allowedAmount = 'Daily time quota cannot exceed 24 hours (1440 minutes)';
    }

    if (formData.warningThreshold < 50 || formData.warningThreshold > 95) {
      errors.warningThreshold = 'Warning threshold must be between 50% and 95%';
    }

    if (formData.effectiveUntil && formData.effectiveFrom &&
        new Date(formData.effectiveUntil) <= new Date(formData.effectiveFrom)) {
      errors.effectiveUntil = 'End date must be after start date';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  }, [formData, validateForm, onSubmit]);

  const handleFieldChange = useCallback((field: keyof QuotaSetupData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
  }, [validationErrors]);

  const getQuotaDisplayText = useCallback(() => {
    if (formData.quotaType === 'TIME_BASED') {
      const hours = Math.floor(formData.allowedAmount / 60);
      const minutes = formData.allowedAmount % 60;
      return hours > 0
        ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`
        : `${minutes}m`;
    }
    return `${formData.allowedAmount} sessions`;
  }, [formData.quotaType, formData.allowedAmount]);

  const selectedUser = users.find(u => u.id === formData.userId);
  const selectedRoom = rooms.find(r => r.roomId === formData.roomId);

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Clock className="h-5 w-5" />
          {initialData ? 'Edit Quota' : 'Create New Quota'}
        </CardTitle>

        {(error || success) && (
          <div className="space-y-2">
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
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Selection */}
          <div className="space-y-2">
            <Label htmlFor="userId" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Select User
            </Label>
            <Select
              value={formData.userId}
              onValueChange={(value) => handleFieldChange('userId', value)}
              disabled={isLoading}
            >
              <SelectTrigger className={cn(
                "w-full",
                validationErrors.userId && "border-red-500"
              )}>
                <SelectValue placeholder="Choose a user to assign quota to" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <span>{user.name}</span>
                      <Badge variant={user.isChild ? "secondary" : "outline"} className="text-xs">
                        {user.isChild ? "Child" : "Parent"}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.userId && (
              <p className="text-sm text-red-600">{validationErrors.userId}</p>
            )}
          </div>

          {/* Room Selection */}
          <div className="space-y-2">
            <Label htmlFor="roomId" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Select Room
            </Label>
            <Select
              value={formData.roomId}
              onValueChange={(value) => handleFieldChange('roomId', value)}
              disabled={isLoading}
            >
              <SelectTrigger className={cn(
                "w-full",
                validationErrors.roomId && "border-red-500"
              )}>
                <SelectValue placeholder="Choose a room for this quota" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.roomId} value={room.roomId}>
                    {room.roomName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.roomId && (
              <p className="text-sm text-red-600">{validationErrors.roomId}</p>
            )}
          </div>

          {/* Quota Type */}
          <div className="space-y-2">
            <Label htmlFor="quotaType">Quota Type</Label>
            <Select
              value={formData.quotaType}
              onValueChange={(value: 'TIME_BASED' | 'SESSION_BASED') =>
                handleFieldChange('quotaType', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TIME_BASED">
                  <div className="space-y-1">
                    <div className="font-medium">Time-Based</div>
                    <div className="text-sm text-muted-foreground">
                      Limit by minutes of usage per day
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="SESSION_BASED">
                  <div className="space-y-1">
                    <div className="font-medium">Session-Based</div>
                    <div className="text-sm text-muted-foreground">
                      Limit by number of AC sessions per day
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Allowed Amount */}
          <div className="space-y-4">
            <Label>
              {formData.quotaType === 'TIME_BASED' ? 'Daily Time Limit' : 'Daily Session Limit'}
            </Label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {formData.quotaType === 'TIME_BASED' ? '15 minutes' : '1 session'}
                </span>
                <span className="text-lg font-semibold text-primary">
                  {getQuotaDisplayText()}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formData.quotaType === 'TIME_BASED' ? '24 hours' : '20 sessions'}
                </span>
              </div>

              <Slider
                value={[formData.allowedAmount]}
                onValueChange={([value]) => handleFieldChange('allowedAmount', value)}
                min={formData.quotaType === 'TIME_BASED' ? 15 : 1}
                max={formData.quotaType === 'TIME_BASED' ? 1440 : 20}
                step={formData.quotaType === 'TIME_BASED' ? 15 : 1}
                className="w-full"
                disabled={isLoading}
              />
            </div>

            {validationErrors.allowedAmount && (
              <p className="text-sm text-red-600">{validationErrors.allowedAmount}</p>
            )}
          </div>

          {/* Warning Threshold */}
          <div className="space-y-4">
            <Label>Warning Threshold</Label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">50%</span>
                <span className="text-lg font-semibold text-amber-600">
                  {formData.warningThreshold}%
                </span>
                <span className="text-sm text-muted-foreground">95%</span>
              </div>

              <Slider
                value={[formData.warningThreshold]}
                onValueChange={([value]) => handleFieldChange('warningThreshold', value)}
                min={50}
                max={95}
                step={5}
                className="w-full"
                disabled={isLoading}
              />

              <p className="text-sm text-muted-foreground">
                Users will receive a warning when they reach this percentage of their quota
              </p>
            </div>

            {validationErrors.warningThreshold && (
              <p className="text-sm text-red-600">{validationErrors.warningThreshold}</p>
            )}
          </div>

          <Separator />

          {/* Date Range (Optional) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">Start Date</Label>
              <Input
                id="effectiveFrom"
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) => handleFieldChange('effectiveFrom', e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveUntil">End Date (Optional)</Label>
              <Input
                id="effectiveUntil"
                type="date"
                value={formData.effectiveUntil}
                onChange={(e) => handleFieldChange('effectiveUntil', e.target.value)}
                disabled={isLoading}
                className={cn(
                  validationErrors.effectiveUntil && "border-red-500"
                )}
              />
              {validationErrors.effectiveUntil && (
                <p className="text-sm text-red-600">{validationErrors.effectiveUntil}</p>
              )}
            </div>
          </div>

          {/* Preview */}
          {selectedUser && selectedRoom && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Quota Preview</h4>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p><strong>{selectedUser.name}</strong> can use <strong>{selectedRoom.roomName}</strong></p>
                <p>for up to <strong>{getQuotaDisplayText()}</strong> per day</p>
                <p>Warning at <strong>{formData.warningThreshold}%</strong> usage</p>
                {formData.effectiveUntil && (
                  <p>Valid until <strong>{new Date(formData.effectiveUntil).toLocaleDateString()}</strong></p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 sm:flex-none"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                  {initialData ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                initialData ? 'Update Quota' : 'Create Quota'
              )}
            </Button>

            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
});

QuotaSetupForm.displayName = 'QuotaSetupForm';

export default QuotaSetupForm;