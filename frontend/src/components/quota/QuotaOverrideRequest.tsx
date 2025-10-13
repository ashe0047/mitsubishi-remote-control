"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
// Use native select for now since @/components/ui/select doesn't exist
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Send,
  User,
  MessageSquare,
  Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Zod schemas for validation
const overrideRequestSchema = z.object({
  requestType: z.enum(['TEMPORARY_INCREASE', 'TIME_EXTENSION', 'EMERGENCY_OVERRIDE']),
  duration: z.number().min(15).max(480), // 15 minutes to 8 hours in minutes
  reason: z.string().min(10).max(500, 'Reason must be less than 500 characters'),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']),
});

type OverrideRequestFormData = z.infer<typeof overrideRequestSchema>;

export interface OverrideRequest {
  id: string;
  quotaId: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  
  // Request details
  requestType: 'TEMPORARY_INCREASE' | 'TIME_EXTENSION' | 'EMERGENCY_OVERRIDE';
  duration: number; // in minutes
  reason: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  
  // Status and timestamps
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requestedAt: string; // ISO timestamp
  respondedAt?: string; // ISO timestamp
  expiresAt?: string; // ISO timestamp
  
  // Response details
  approvedBy?: string; // family member ID
  responseReason?: string;
  actualDuration?: number; // approved duration might differ from requested
}

interface QuotaOverrideRequestProps {
  quotaId: string;
  familyMemberId: string;
  familyMemberName: string;
  roomId: string;
  roomName: string;
  currentUsage: number;
  dailyLimit: number;
  quotaType: 'TIME_BASED' | 'USAGE_BASED' | 'ENERGY_BASED' | 'COST_BASED';
  onRequestSubmit?: (request: OverrideRequestFormData) => Promise<void>;
  className?: string;
}

export const QuotaOverrideRequest: React.FC<QuotaOverrideRequestProps> = ({
  roomName,
  currentUsage,
  dailyLimit,
  quotaType,
  onRequestSubmit,
  className,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<OverrideRequestFormData>({
    resolver: zodResolver(overrideRequestSchema),
    defaultValues: {
      requestType: 'TIME_EXTENSION',
      duration: 60, // 1 hour default
      reason: '',
      urgency: 'MEDIUM',
    },
  });

  const watchRequestType = form.watch('requestType');
  const watchUrgency = form.watch('urgency');

  const onSubmit = async (data: OverrideRequestFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onRequestSubmit?.(data);
      setSubmitSuccess(true);
      form.reset();
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit override request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRequestTypeDescription = (type: string) => {
    switch (type) {
      case 'TEMPORARY_INCREASE':
        return 'Request a temporary increase to your daily quota limit';
      case 'TIME_EXTENSION':
        return 'Request additional time beyond your current quota';
      case 'EMERGENCY_OVERRIDE':
        return 'Override quota restrictions for emergency situations';
      default:
        return '';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'LOW': return 'text-green-600 dark:text-green-400';
      case 'MEDIUM': return 'text-yellow-600 dark:text-yellow-400';
      case 'HIGH': return 'text-orange-600 dark:text-orange-400';
      case 'EMERGENCY': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatUsage = (usage: number) => {
    switch (quotaType) {
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

  if (submitSuccess) {
    return (
      <Alert className={cn("border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950", className)}>
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          Override request submitted successfully! You will be notified when a parent responds.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span>Request Quota Override</span>
        </CardTitle>
        <CardDescription>
          Current usage: {formatUsage(currentUsage)} of {formatUsage(dailyLimit)} used in {roomName}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Request Type Selection */}
          <div className="space-y-3">
            <Label htmlFor="requestType">Request Type</Label>
            <select
              id="requestType"
              value={form.watch('requestType')}
              onChange={(e) => form.setValue('requestType', e.target.value as 'TIME_EXTENSION' | 'TEMPORARY_INCREASE' | 'EMERGENCY_OVERRIDE')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select request type</option>
              <option value="TIME_EXTENSION">Time Extension</option>
              <option value="TEMPORARY_INCREASE">Temporary Increase</option>
              <option value="EMERGENCY_OVERRIDE">Emergency Override</option>
            </select>
            <p className="text-sm text-muted-foreground">
              {getRequestTypeDescription(watchRequestType)}
            </p>
          </div>

          {/* Duration Input */}
          <div className="space-y-3">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <div className="flex items-center space-x-4">
              <Input
                type="number"
                min="15"
                max="480"
                step="15"
                {...form.register('duration', { valueAsNumber: true })}
                className="w-32"
              />
              <div className="flex space-x-2">
                {[30, 60, 120, 240].map((minutes) => (
                  <Button
                    key={minutes}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => form.setValue('duration', minutes)}
                    className="text-xs"
                  >
                    {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                  </Button>
                ))}
              </div>
            </div>
            {form.formState.errors.duration && (
              <p className="text-sm text-red-600">
                {form.formState.errors.duration.message}
              </p>
            )}
          </div>

          {/* Urgency Selection */}
          <div className="space-y-3">
            <Label htmlFor="urgency">Urgency Level</Label>
            <select
              id="urgency"
              value={form.watch('urgency')}
              onChange={(e) => form.setValue('urgency', e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select urgency level</option>
              <option value="LOW">Low - Can wait</option>
              <option value="MEDIUM">Medium - Preferred soon</option>
              <option value="HIGH">High - Important</option>
              <option value="EMERGENCY">Emergency - Immediate need</option>
            </select>
          </div>

          {/* Reason Textarea */}
          <div className="space-y-3">
            <Label htmlFor="reason">
              Reason for Request <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Please explain why you need this override..."
              rows={4}
              {...form.register('reason')}
              className={cn(
                form.formState.errors.reason && "border-red-500 focus:border-red-500"
              )}
            />
            <div className="flex items-center justify-between text-xs">
              <span className={cn(
                "text-muted-foreground",
                form.formState.errors.reason && "text-red-600"
              )}>
                {form.formState.errors.reason ? 
                  form.formState.errors.reason.message : 
                  'Minimum 10 characters required'
                }
              </span>
              <span className="text-muted-foreground">
                {form.watch('reason')?.length || 0}/500
              </span>
            </div>
          </div>

          {/* Request Summary */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Request Summary</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Type:</span>
                <Badge variant="outline">{watchRequestType.replace('_', ' ')}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Duration:</span>
                <span>{form.watch('duration')} minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Urgency:</span>
                <Badge 
                  variant="outline" 
                  className={getUrgencyColor(watchUrgency)}
                >
                  {watchUrgency}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Room:</span>
                <span>{roomName}</span>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {submitError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => form.reset()}
              disabled={isSubmitting}
            >
              Clear
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !form.formState.isValid}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Request...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Request
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// Component for displaying existing override requests
interface OverrideRequestListProps {
  requests: OverrideRequest[];
  onApprove?: (requestId: string, duration?: number, reason?: string) => Promise<void>;
  onReject?: (requestId: string, reason: string) => Promise<void>;
  showActions?: boolean; // Show approve/reject buttons (for parents)
  className?: string;
}

export const OverrideRequestList: React.FC<OverrideRequestListProps> = ({
  requests,
  onApprove,
  onReject,
  showActions = false,
  className,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await onApprove?.(requestId);
    } catch (error) {
      console.error('Failed to approve request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await onReject?.(requestId, rejectReason);
      setRejectReason('');
      setShowRejectForm(null);
    } catch (error) {
      console.error('Failed to reject request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusIcon = (status: OverrideRequest['status']) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'APPROVED': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'REJECTED': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'EXPIRED': return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: OverrideRequest['status']) => {
    switch (status) {
      case 'PENDING': return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950';
      case 'APPROVED': return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950';
      case 'REJECTED': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
      case 'EXPIRED': return 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950';
      default: return '';
    }
  };

  if (requests.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <MessageSquare className="h-8 w-8 mx-auto mb-2" />
        <p>No override requests</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {requests.map((request) => (
        <Card key={request.id} className={cn("border-2", getStatusColor(request.status))}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStatusIcon(request.status)}
                <CardTitle className="text-base">
                  {request.requestType.replace('_', ' ')} Request
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {request.urgency}
                </Badge>
              </div>
              <Badge variant={request.status === 'PENDING' ? 'default' : 'secondary'}>
                {request.status}
              </Badge>
            </div>
            <CardDescription className="flex items-center space-x-4 text-xs">
              <span className="flex items-center space-x-1">
                <User className="h-3 w-3" />
                <span>{request.familyMemberName}</span>
              </span>
              <span>•</span>
              <span>{request.roomName}</span>
              <span>•</span>
              <span>{request.duration} minutes</span>
              <span>•</span>
              <span>{new Date(request.requestedAt).toLocaleDateString()}</span>
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-3">
            <div>
              <h5 className="font-medium text-sm mb-1">Reason:</h5>
              <p className="text-sm text-muted-foreground">{request.reason}</p>
            </div>

            {request.responseReason && (
              <div>
                <h5 className="font-medium text-sm mb-1">Response:</h5>
                <p className="text-sm text-muted-foreground">{request.responseReason}</p>
              </div>
            )}

            {showActions && request.status === 'PENDING' && (
              <div className="pt-2 border-t">
                {showRejectForm === request.id ? (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Reason for rejection..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowRejectForm(null);
                          setRejectReason('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleReject(request.id)}
                        disabled={!rejectReason.trim() || processingId === request.id}
                      >
                        {processingId === request.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Reject'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectForm(request.id)}
                      disabled={processingId === request.id}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(request.id)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-1 h-3 w-3" />
                      )}
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default QuotaOverrideRequest;