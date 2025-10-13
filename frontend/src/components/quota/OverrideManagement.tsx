"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Clock,
  Unlock,
  Zap,
  Shield,
  User,
  Home,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OverrideRecord {
  id: string;
  quotaId: string;
  userId: string;
  userName: string;
  roomId: string;
  roomName: string;
  type: 'ADD_TIME' | 'UNLOCK_DAY' | 'EMERGENCY_OVERRIDE';
  additionalSeconds?: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  expiresAt?: string;
  metadata?: {
    originalUsage?: number;
    newAllowance?: number;
  };
}

export interface OverrideStats {
  totalRequests: number;
  pendingRequests: number;
  approvedToday: number;
  averageResponseTime: number; // in minutes
  mostCommonType: string;
  topRequestingUser: string;
}

export interface OverrideManagementProps {
  /** List of override records */
  overrides: OverrideRecord[];
  /** Summary statistics */
  stats?: OverrideStats;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Whether user has permission to approve/deny overrides */
  canApprove?: boolean;
  /** Selected time period filter */
  period?: 'today' | 'week' | 'month' | 'all';
  /** Callback when period changes */
  onPeriodChange?: (period: 'today' | 'week' | 'month' | 'all') => void;
  /** Callback when override is approved */
  onApproveOverride?: (overrideId: string) => Promise<void>;
  /** Callback when override is denied */
  onDenyOverride?: (overrideId: string, reason?: string) => Promise<void>;
  /** Callback to refresh data */
  onRefresh?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export const OverrideManagement: React.FC<OverrideManagementProps> = React.memo(({
  overrides,
  stats,
  isLoading = false,
  error,
  canApprove = false,
  period = 'week',
  onPeriodChange,
  onApproveOverride,
  onDenyOverride,
  onRefresh,
  className
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'analytics'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filter overrides based on status and period
  const filteredOverrides = useMemo(() => {
    let filtered = overrides;

    // Apply period filter
    if (period !== 'all') {
      const now = new Date();
      const cutoff = new Date();

      switch (period) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter(override =>
        new Date(override.requestedAt) >= cutoff
      );
    }

    return filtered;
  }, [overrides, period]);

  const pendingOverrides = useMemo(() =>
    filteredOverrides.filter(o => o.status === 'PENDING'),
    [filteredOverrides]
  );

  const processedOverrides = useMemo(() =>
    filteredOverrides.filter(o => o.status !== 'PENDING'),
    [filteredOverrides]
  );

  const getOverrideIcon = useCallback((type: OverrideRecord['type']) => {
    switch (type) {
      case 'ADD_TIME': return <Clock className="h-4 w-4" />;
      case 'UNLOCK_DAY': return <Unlock className="h-4 w-4" />;
      case 'EMERGENCY_OVERRIDE': return <Zap className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  }, []);

  const getOverrideTypeLabel = useCallback((type: OverrideRecord['type']) => {
    switch (type) {
      case 'ADD_TIME': return 'Add Time';
      case 'UNLOCK_DAY': return 'Unlock Day';
      case 'EMERGENCY_OVERRIDE': return 'Emergency';
      default: return 'Unknown';
    }
  }, []);

  const getStatusColor = useCallback((status: OverrideRecord['status']) => {
    switch (status) {
      case 'PENDING': return 'secondary';
      case 'APPROVED': return 'default';
      case 'DENIED': return 'destructive';
      case 'EXPIRED': return 'outline';
      default: return 'outline';
    }
  }, []);

  const formatDuration = useCallback((seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }, []);

  const handleApprove = useCallback(async (overrideId: string) => {
    if (!onApproveOverride) return;

    setProcessingId(overrideId);
    try {
      await onApproveOverride(overrideId);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to approve override:', error);
    } finally {
      setProcessingId(null);
    }
  }, [onApproveOverride, onRefresh]);

  const handleDeny = useCallback(async (overrideId: string) => {
    if (!onDenyOverride) return;

    const reason = window.prompt('Please provide a reason for denying this override:');
    if (!reason) return;

    setProcessingId(overrideId);
    try {
      await onDenyOverride(overrideId, reason);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to deny override:', error);
    } finally {
      setProcessingId(null);
    }
  }, [onDenyOverride, onRefresh]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2 mb-3"></div>
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

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Override Management</h1>
          <p className="text-muted-foreground">
            Review and manage quota override requests
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Filter */}
          {onPeriodChange && (
            <Select value={period} onValueChange={onPeriodChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Refresh Button */}
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh} size="sm">
              <History className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{stats.totalRequests}</p>
                </div>
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.pendingRequests}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved Today</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approvedToday}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Response</p>
                  <p className="text-2xl font-bold">{Math.round(stats.averageResponseTime)}m</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pending' | 'history' | 'analytics')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pending ({pendingOverrides.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Pending Overrides Tab */}
        <TabsContent value="pending" className="space-y-4">
          {pendingOverrides.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Pending Requests</h3>
                <p className="text-muted-foreground">
                  All override requests have been processed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingOverrides.map((override) => (
                <Card key={override.id} className="border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          {getOverrideIcon(override.type)}
                          {getOverrideTypeLabel(override.type)} Request
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {override.userName}
                          </div>
                          <div className="flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            {override.roomName}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(override.requestedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <Badge variant={getStatusColor(override.status)}>
                        {override.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Request Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium mb-1">Request Type</p>
                        <p className="text-sm text-muted-foreground">
                          {override.type === 'ADD_TIME' && override.additionalSeconds
                            ? `Add ${formatDuration(override.additionalSeconds)} to daily quota`
                            : override.type === 'UNLOCK_DAY'
                            ? 'Reset daily usage counter'
                            : 'Emergency quota bypass'}
                        </p>
                      </div>

                      {override.expiresAt && (
                        <div>
                          <p className="text-sm font-medium mb-1">Expires</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(override.expiresAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Reason */}
                    <div>
                      <p className="text-sm font-medium mb-1">Reason</p>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                        {override.reason}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    {canApprove && override.status === 'PENDING' && (
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          onClick={() => handleApprove(override.id)}
                          disabled={processingId === override.id}
                          size="sm"
                          className="flex-1"
                        >
                          {processingId === override.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Approve
                        </Button>

                        <Button
                          variant="destructive"
                          onClick={() => handleDeny(override.id)}
                          disabled={processingId === override.id}
                          size="sm"
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Deny
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {processedOverrides.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No History</h3>
                <p className="text-muted-foreground">
                  No processed override requests found.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {processedOverrides.map((override) => (
                <Card key={override.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getOverrideIcon(override.type)}
                        <div>
                          <p className="font-medium text-sm">
                            {getOverrideTypeLabel(override.type)} - {override.userName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {override.roomName} • {new Date(override.requestedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor(override.status)}>
                          {override.status}
                        </Badge>
                        {override.processedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(override.processedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {override.reason && (
                      <p className="text-xs text-muted-foreground mt-2 pl-7">
                        {override.reason.length > 100
                          ? `${override.reason.substring(0, 100)}...`
                          : override.reason}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Override Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Request Patterns</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Most Common Type:</span>
                        <span className="font-medium">{stats.mostCommonType}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Top Requesting User:</span>
                        <span className="font-medium">{stats.topRequestingUser}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Average Response Time:</span>
                        <span className="font-medium">{Math.round(stats.averageResponseTime)} minutes</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Approval Rates</h4>
                    <div className="text-center text-muted-foreground">
                      <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                      <p>Detailed analytics charts would be implemented here</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4" />
                  <p>No analytics data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});

OverrideManagement.displayName = 'OverrideManagement';

export default OverrideManagement;