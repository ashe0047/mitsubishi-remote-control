"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  User,
  Home,
  Edit,
  Trash2,
  AlertTriangle,
  Pause,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuotaData {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roomId: string;
  roomName: string;
  quotaType: 'TIME_BASED' | 'SESSION_BASED';
  allowedAmount: number;
  usedAmount: number;
  warningThreshold: number;
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'EXCEEDED';
  effectiveFrom: string;
  effectiveUntil?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaListProps {
  /** List of quotas to display */
  quotas: QuotaData[];
  /** Whether the list is in loading state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** Callback when edit is clicked */
  onEdit?: (quota: QuotaData) => void;
  /** Callback when delete is clicked */
  onDelete?: (quotaId: string) => void;
  /** Callback when pause/resume is clicked */
  onToggleStatus?: (quotaId: string, newStatus: 'ACTIVE' | 'PAUSED') => void;
  /** Whether delete/edit actions are allowed (parent permissions) */
  canManage?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const QuotaList: React.FC<QuotaListProps> = React.memo(({
  quotas,
  isLoading = false,
  error,
  onEdit,
  onDelete,
  onToggleStatus,
  canManage = false,
  className
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const getStatusColor = useCallback((status: QuotaData['status']) => {
    switch (status) {
      case 'ACTIVE': return 'default';
      case 'PAUSED': return 'secondary';
      case 'EXPIRED': return 'outline';
      case 'EXCEEDED': return 'destructive';
      default: return 'outline';
    }
  }, []);

  const getUsagePercentage = useCallback((quota: QuotaData) => {
    if (quota.allowedAmount <= 0) return 0;
    return Math.min((quota.usedAmount / quota.allowedAmount) * 100, 100);
  }, []);

  const getUsageColor = useCallback((percentage: number, warningThreshold: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= warningThreshold) return 'bg-yellow-500';
    return 'bg-green-500';
  }, []);

  const formatAmount = useCallback((amount: number, type: QuotaData['quotaType']) => {
    if (type === 'TIME_BASED') {
      const hours = Math.floor(amount / 60);
      const minutes = amount % 60;
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    return `${amount} sessions`;
  }, []);

  const handleDelete = useCallback(async (quotaId: string) => {
    if (!onDelete) return;

    if (window.confirm('Are you sure you want to delete this quota? This action cannot be undone.')) {
      setDeletingId(quotaId);
      try {
        await onDelete(quotaId);
      } finally {
        setDeletingId(null);
      }
    }
  }, [onDelete]);

  const handleToggleStatus = useCallback(async (quota: QuotaData) => {
    if (!onToggleStatus) return;

    const newStatus = quota.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setTogglingId(quota.id);

    try {
      await onToggleStatus(quota.id, newStatus);
    } finally {
      setTogglingId(null);
    }
  }, [onToggleStatus]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2 mb-3"></div>
                <div className="h-2 bg-muted rounded w-full"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (quotas.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Quotas Found</h3>
          <p className="text-muted-foreground">
            No quotas have been set up yet. Create your first quota to start managing usage.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {quotas.map((quota) => {
        const usagePercentage = getUsagePercentage(quota);
        const isWarning = usagePercentage >= quota.warningThreshold;
        const isExceeded = usagePercentage >= 100;

        return (
          <Card
            key={quota.id}
            className={cn(
              "transition-all duration-200",
              isExceeded && "border-red-200 dark:border-red-800",
              isWarning && !isExceeded && "border-yellow-200 dark:border-yellow-800"
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {quota.userName}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Home className="h-3 w-3" />
                    {quota.roomName}
                    <Separator orientation="vertical" className="h-4" />
                    <Clock className="h-3 w-3" />
                    {quota.quotaType === 'TIME_BASED' ? 'Time-based' : 'Session-based'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={getStatusColor(quota.status)}>
                    {quota.status}
                  </Badge>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      {/* Pause/Resume Button */}
                      {onToggleStatus && (quota.status === 'ACTIVE' || quota.status === 'PAUSED') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(quota)}
                          disabled={togglingId === quota.id}
                          className="h-8 w-8 p-0"
                        >
                          {togglingId === quota.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
                          ) : quota.status === 'ACTIVE' ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                      )}

                      {/* Edit Button */}
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(quota)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}

                      {/* Delete Button */}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(quota.id)}
                          disabled={deletingId === quota.id}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingId === quota.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Usage Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Usage</span>
                  <span className={cn(
                    "font-medium",
                    isExceeded && "text-red-600",
                    isWarning && !isExceeded && "text-yellow-600"
                  )}>
                    {formatAmount(quota.usedAmount, quota.quotaType)} / {formatAmount(quota.allowedAmount, quota.quotaType)}
                  </span>
                </div>

                <Progress
                  value={usagePercentage}
                  className="h-2"
                  indicatorClassName={getUsageColor(usagePercentage, quota.warningThreshold)}
                />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{Math.round(usagePercentage)}% used</span>
                  <span>Warning at {quota.warningThreshold}%</span>
                </div>
              </div>

              {/* Status Messages */}
              {isExceeded && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Quota exceeded! AC usage is blocked until tomorrow.
                  </AlertDescription>
                </Alert>
              )}

              {isWarning && !isExceeded && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Approaching quota limit. {formatAmount(quota.allowedAmount - quota.usedAmount, quota.quotaType)} remaining.
                  </AlertDescription>
                </Alert>
              )}

              {quota.status === 'PAUSED' && (
                <Alert>
                  <Pause className="h-4 w-4" />
                  <AlertDescription>
                    This quota is paused and not currently enforced.
                  </AlertDescription>
                </Alert>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t">
                <div>
                  <span className="font-medium">Valid:</span>
                  <br />
                  {new Date(quota.effectiveFrom).toLocaleDateString()}
                  {quota.effectiveUntil && (
                    <> - {new Date(quota.effectiveUntil).toLocaleDateString()}</>
                  )}
                </div>
                {quota.lastUsedAt && (
                  <div>
                    <span className="font-medium">Last used:</span>
                    <br />
                    {new Date(quota.lastUsedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});

QuotaList.displayName = 'QuotaList';

export default QuotaList;