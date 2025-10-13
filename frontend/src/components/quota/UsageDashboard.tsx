"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Home,
  Calendar,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UsageData {
  userId: string;
  userName: string;
  roomId: string;
  roomName: string;
  quotaType: 'TIME_BASED' | 'SESSION_BASED';
  allowedAmount: number;
  usedAmount: number;
  warningThreshold: number;
  status: 'ACTIVE' | 'PAUSED' | 'EXCEEDED';
  todayUsage: number;
  weeklyUsage: number;
  monthlyUsage: number;
  sessions: Array<{
    id: string;
    startTime: string;
    endTime?: string;
    duration: number;
    roomId: string;
    roomName: string;
  }>;
}

export interface UsageTrends {
  daily: Array<{ date: string; usage: number }>;
  weekly: Array<{ week: string; usage: number }>;
  peakHours: Array<{ hour: number; usage: number }>;
}

export interface UsageDashboardProps {
  /** Usage data for current user or household */
  usageData: UsageData[];
  /** Trend data for charts */
  trends?: UsageTrends;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Whether viewing household data (parent view) */
  isHouseholdView?: boolean;
  /** Selected period for analysis */
  period?: 'today' | 'week' | 'month';
  /** Callback when period changes */
  onPeriodChange?: (period: 'today' | 'week' | 'month') => void;
  /** Callback to refresh data */
  onRefresh?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export const UsageDashboard: React.FC<UsageDashboardProps> = React.memo(({
  usageData,
  trends,
  isLoading = false,
  error,
  isHouseholdView = false,
  period = 'today',
  onPeriodChange,
  onRefresh,
  className
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'trends'>('overview');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const filteredData = selectedUser === 'all'
      ? usageData
      : usageData.filter(d => d.userId === selectedUser);

    const totalQuotas = filteredData.length;
    const activeQuotas = filteredData.filter(d => d.status === 'ACTIVE').length;
    const exceededQuotas = filteredData.filter(d => d.status === 'EXCEEDED').length;

    const totalUsage = filteredData.reduce((sum, d) => {
      switch (period) {
        case 'today': return sum + d.todayUsage;
        case 'week': return sum + d.weeklyUsage;
        case 'month': return sum + d.monthlyUsage;
        default: return sum + d.todayUsage;
      }
    }, 0);

    const totalAllowed = filteredData.reduce((sum, d) => sum + d.allowedAmount, 0);
    const averageUtilization = totalAllowed > 0 ? (totalUsage / totalAllowed) * 100 : 0;

    return {
      totalQuotas,
      activeQuotas,
      exceededQuotas,
      totalUsage,
      totalAllowed,
      averageUtilization
    };
  }, [usageData, selectedUser, period]);

  const formatUsageAmount = useCallback((amount: number, type: 'TIME_BASED' | 'SESSION_BASED') => {
    if (type === 'TIME_BASED') {
      const hours = Math.floor(amount / 60);
      const minutes = amount % 60;
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    return `${amount} sessions`;
  }, []);

  const getUsagePercentage = useCallback((used: number, allowed: number) => {
    return allowed > 0 ? Math.min((used / allowed) * 100, 100) : 0;
  }, []);

  const getUsageColor = useCallback((percentage: number, warningThreshold: number) => {
    if (percentage >= 100) return 'text-red-600';
    if (percentage >= warningThreshold) return 'text-yellow-600';
    return 'text-green-600';
  }, []);

  const getUsageStatus = useCallback((percentage: number, warningThreshold: number) => {
    if (percentage >= 100) return { label: 'Exceeded', variant: 'destructive' as const };
    if (percentage >= warningThreshold) return { label: 'Warning', variant: 'secondary' as const };
    return { label: 'Normal', variant: 'default' as const };
  }, []);

  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const users = Array.from(new Set(usageData.map(d => d.userId)))
      .map(userId => {
        const userData = usageData.find(d => d.userId === userId);
        return userData ? { id: userId, name: userData.userName } : null;
      })
      .filter(Boolean) as Array<{ id: string; name: string }>;

    return users;
  }, [usageData]);

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

  if (usageData.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Usage Data</h3>
          <p className="text-muted-foreground">
            No usage data available for the selected period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {isHouseholdView ? 'Household Usage' : 'My Usage'}
          </h1>
          <p className="text-muted-foreground">
            Track and monitor AC usage across quotas
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* User Filter (for household view) */}
          {isHouseholdView && uniqueUsers.length > 1 && (
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
              </SelectContent>
            </Select>
          )}

          {/* Refresh Button */}
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh} size="sm">
              <Activity className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Usage</p>
                <p className="text-2xl font-bold">
                  {Math.round(summaryStats.totalUsage)}{period === 'today' ? 'm' : 'h'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Utilization</p>
                <p className={cn(
                  "text-2xl font-bold",
                  summaryStats.averageUtilization >= 100 ? "text-red-600" :
                  summaryStats.averageUtilization >= 75 ? "text-yellow-600" : "text-green-600"
                )}>
                  {Math.round(summaryStats.averageUtilization)}%
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Quotas</p>
                <p className="text-2xl font-bold text-green-600">
                  {summaryStats.activeQuotas}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Exceeded</p>
                <p className="text-2xl font-bold text-red-600">
                  {summaryStats.exceededQuotas}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detailed">Detailed View</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Current Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {usageData
                  .filter(d => selectedUser === 'all' || d.userId === selectedUser)
                  .slice(0, 5)
                  .map((data) => {
                    const percentage = getUsagePercentage(data.todayUsage, data.allowedAmount);
                    const status = getUsageStatus(percentage, data.warningThreshold);

                    return (
                      <div key={`${data.userId}-${data.roomId}`} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{data.userName}</span>
                            <Badge variant="outline" className="text-xs">
                              {data.roomName}
                            </Badge>
                          </div>
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                        </div>

                        <Progress value={percentage} className="h-2" />

                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {formatUsageAmount(data.todayUsage, data.quotaType)} used
                          </span>
                          <span>
                            {formatUsageAmount(data.allowedAmount, data.quotaType)} allowed
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {usageData
                    .flatMap(d => d.sessions.map(s => ({ ...s, userName: d.userName })))
                    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                    .slice(0, 5)
                    .map((session) => (
                      <div key={session.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{session.userName}</span>
                            <Badge variant="outline" className="text-xs">
                              {session.roomName}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.startTime).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {Math.round(session.duration)}m
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.endTime ? 'Completed' : 'Active'}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Detailed View Tab */}
        <TabsContent value="detailed" className="space-y-4">
          <div className="grid gap-4">
            {usageData
              .filter(d => selectedUser === 'all' || d.userId === selectedUser)
              .map((data) => {
                const todayPercentage = getUsagePercentage(data.todayUsage, data.allowedAmount);
                const weeklyPercentage = getUsagePercentage(data.weeklyUsage, data.allowedAmount * 7);
                const monthlyPercentage = getUsagePercentage(data.monthlyUsage, data.allowedAmount * 30);

                return (
                  <Card key={`${data.userId}-${data.roomId}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          {data.userName}
                          <Badge variant="outline">{data.roomName}</Badge>
                        </CardTitle>
                        <Badge variant={data.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {data.status}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Usage Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Today</span>
                            <span className={cn(
                              "text-sm font-medium",
                              getUsageColor(todayPercentage, data.warningThreshold)
                            )}>
                              {Math.round(todayPercentage)}%
                            </span>
                          </div>
                          <Progress value={todayPercentage} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {formatUsageAmount(data.todayUsage, data.quotaType)} / {formatUsageAmount(data.allowedAmount, data.quotaType)}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">This Week</span>
                            <span className="text-sm font-medium">
                              {Math.round(weeklyPercentage)}%
                            </span>
                          </div>
                          <Progress value={weeklyPercentage} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {formatUsageAmount(data.weeklyUsage, data.quotaType)}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">This Month</span>
                            <span className="text-sm font-medium">
                              {Math.round(monthlyPercentage)}%
                            </span>
                          </div>
                          <Progress value={monthlyPercentage} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {formatUsageAmount(data.monthlyUsage, data.quotaType)}
                          </p>
                        </div>
                      </div>

                      {/* Warnings */}
                      {todayPercentage >= 100 && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Daily quota exceeded. AC usage is blocked until tomorrow.
                          </AlertDescription>
                        </Alert>
                      )}

                      {todayPercentage >= data.warningThreshold && todayPercentage < 100 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Approaching quota limit. {formatUsageAmount(data.allowedAmount - data.todayUsage, data.quotaType)} remaining today.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Usage Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trends ? (
                <div className="space-y-6">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                    <p>Trend analysis charts would be implemented here using a charting library like Chart.js or Recharts</p>
                    <p className="text-sm mt-2">
                      Data available: {trends.daily.length} daily points, {trends.weekly.length} weekly points
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4" />
                  <p>No trend data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});

UsageDashboard.displayName = 'UsageDashboard';

export default UsageDashboard;