"use client";

import React, { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, Users, UserPlus, Home, Settings, AlertCircle, Clock, Activity, TrendingUp, AlertTriangle, DoorOpen } from 'lucide-react';
import { useFamilyStore, useFamilyMembers, useFamilyStats, useFamilyLoading, useFamilyError } from '@/stores/family-store';
import { useAuthStore } from '@/stores/auth-store';
import { useQuotaStore, useUserViolations, useQuotaConnectionStatus } from '@/stores/quota-store';
import { FamilyMember, hasPermission, FamilyPermission } from '@/types/family';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';

interface FamilyDashboardProps {
  className?: string;
}

interface QuotaBalance {
  current: number;
  limit: number;
  percentage: number;
  status: 'active' | 'warning' | 'exceeded';
  lastUpdated: string;
}

interface MemberQuotaBalances {
  [roomId: string]: QuotaBalance;
}

interface AllQuotaBalances {
  [memberId: string]: MemberQuotaBalances;
}

/**
 * Family Dashboard Component - Main overview interface for family management
 * Displays family statistics, member overview, and quick actions
 */
export const FamilyDashboard: React.FC<FamilyDashboardProps> = ({ className }) => {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const familyMembers = useFamilyMembers();
  const familyStats = useFamilyStats();
  const loading = useFamilyLoading();
  const error = useFamilyError();
  
  // Quota store integration with proper Zustand v5 patterns
  const quotaConnectionStatus = useQuotaConnectionStatus();
  const userViolations = useUserViolations(user?.id || '');
  
  // Use useShallow for multiple quota store selections to prevent rerenders
  const [quotaBalances, isLoadingBalances] = useQuotaStore(
    useShallow((state) => [state.balances, state.isLoadingBalances])
  );
  
  // Check if current user can manage family
  const canManageFamily = hasPermission(user?.role, FamilyPermission.MANAGE_FAMILY);
  const canManageQuotas = hasPermission(user?.role, FamilyPermission.MANAGE_QUOTAS);


  useEffect(() => {
    if (user) {
      // Get the latest functions from the store inside useEffect to avoid dependency issues
      const { loadFamilyMembers, loadFamilyStats } = useFamilyStore.getState();
      const { refreshAllBalances } = useQuotaStore.getState();
      
      loadFamilyMembers();
      loadFamilyStats();
      
      // Load quota data for family overview
      if (canManageFamily) {
        refreshAllBalances(user.id).catch(console.error);
      }
    }
  }, [user, canManageFamily]);

  // Extract store actions using selectors (these are stable)
  const clearError = useFamilyStore((state) => state.clearError);

  if (!user) {
    return (
      <Card className={cn("w-full max-w-4xl mx-auto", className)}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Please log in to view your family dashboard
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("w-full max-w-6xl mx-auto space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Family Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your family members and monitor AC usage across all rooms
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearError}
              className="h-8 px-2"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Quota Connection Status Alert */}
      {!quotaConnectionStatus.isConnected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Quota system disconnected. Real-time quota updates may not be available.
            {quotaConnectionStatus.lastSyncTime && (
              <span className="text-xs block mt-1">
                Last sync: {new Date(quotaConnectionStatus.lastSyncTime).toLocaleTimeString()}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Active Violations Alert */}
      {userViolations.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {userViolations.length} active quota violation(s) require attention.
            <Button variant="ghost" size="sm" className="ml-2">
              View Details
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Family Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading.isLoadingStats ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                familyStats?.totalMembers || familyMembers.length
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Active family members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parents</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading.isLoadingStats ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                familyStats?.parentCount || familyMembers.filter(m => m.role === 'parent').length
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              With management access
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Children</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading.isLoadingStats ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                familyStats?.childCount || familyMembers.filter(m => m.role === 'child').length
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              With room access
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Quotas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingBalances ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                getTotalActiveQuotas(quotaBalances, familyMembers)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Family quota configurations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Family Quota Overview */}
      {canManageFamily && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Family Quota Status
            </CardTitle>
            <CardDescription>
              Real-time usage overview for all family members
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingBalances ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading quota data...
              </div>
            ) : (
              <FamilyQuotaOverview 
                familyMembers={familyMembers}
                quotaBalances={quotaBalances}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Family Members Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Family Members</CardTitle>
              <CardDescription>
                Manage your family members and their access levels
              </CardDescription>
            </div>
            {canManageFamily && (
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading.isLoadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading family members...
            </div>
          ) : familyMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No family members found
            </div>
          ) : (
            <div className="space-y-4">
              {familyMembers.map((member: FamilyMember, index: number) => (
                <div key={member.id}>
                  {index > 0 && <Separator />}
                  <FamilyMemberRow 
                    member={member} 
                    currentUser={user}
                    quotaBalances={quotaBalances[member.id] || {}}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {canManageFamily && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common family management tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => router.push('/dashboard/family')}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Family Member
              </Button>
              <Button variant="outline" onClick={() => router.push('/admin/rooms')}>
                <DoorOpen className="mr-2 h-4 w-4" />
                Manage Rooms
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/rooms')}>
                <Home className="mr-2 h-4 w-4" />
                Manage Room Access
              </Button>
              <Button variant="outline" onClick={() => router.push('/quota')}>
                <Settings className="mr-2 h-4 w-4" />
                Configure Quotas
              </Button>
              <Button variant="outline" onClick={() => router.push('/quota')}>
                <TrendingUp className="mr-2 h-4 w-4" />
                View Usage Analytics
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Helper function to calculate total active quotas
const getTotalActiveQuotas = (quotaBalances: AllQuotaBalances, familyMembers: FamilyMember[]): number => {
  let totalQuotas = 0;
  
  familyMembers.forEach(member => {
    const memberBalances = quotaBalances[member.id] || {};
    totalQuotas += Object.keys(memberBalances).length;
  });
  
  return totalQuotas;
};

/**
 * Family Quota Overview Component
 */
interface FamilyQuotaOverviewProps {
  familyMembers: FamilyMember[];
  quotaBalances: AllQuotaBalances;
}

const FamilyQuotaOverview: React.FC<FamilyQuotaOverviewProps> = ({ familyMembers, quotaBalances }) => {
  const getUsagePercentage = useCallback((balance: QuotaBalance) => {
    if (!balance || !balance.totalSeconds || balance.usedSeconds === undefined) return 0;
    return Math.min((balance.usedSeconds / balance.totalSeconds) * 100, 100);
  }, []);


  if (familyMembers.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No family members to display quota information for
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {familyMembers.filter(member => member.role === 'child').map((member) => {
        const memberBalances = quotaBalances[member.id] || {};
        const roomCount = Object.keys(memberBalances).length;
        
        if (roomCount === 0) {
          return (
            <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 rounded-full bg-gray-400" />
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-xs text-muted-foreground">No quota configurations</div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                Setup needed
              </Badge>
            </div>
          );
        }

        // Calculate average usage across all rooms
        const usagePercentages = Object.values(memberBalances).map(balance => getUsagePercentage(balance));
        const avgUsage = usagePercentages.reduce((sum, pct) => sum + pct, 0) / usagePercentages.length;
        const maxUsage = Math.max(...usagePercentages);
        
        return (
          <div key={member.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  maxUsage >= 90 ? "bg-red-500" : maxUsage >= 75 ? "bg-yellow-500" : "bg-green-500"
                )} />
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {roomCount} room{roomCount !== 1 ? 's' : ''} • Avg usage: {Math.round(avgUsage)}%
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge 
                  variant={maxUsage >= 90 ? "destructive" : maxUsage >= 75 ? "secondary" : "default"}
                  className="text-xs"
                >
                  {maxUsage >= 90 ? 'Over limit' : maxUsage >= 75 ? 'Near limit' : 'Normal'}
                </Badge>
              </div>
            </div>
            
            {/* Room-by-room breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-5">
              {Object.entries(memberBalances).map(([roomId, balance]: [string, QuotaBalance]) => {
                const usage = getUsagePercentage(balance);
                const remaining = balance.remainingSeconds || 0;
                const remainingHours = Math.floor(remaining / 3600);
                const remainingMins = Math.floor((remaining % 3600) / 60);
                
                return (
                  <div key={roomId} className="p-2 border rounded text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{roomId}</span>
                      <span className={cn(
                        "text-xs",
                        usage >= 90 ? "text-red-600" : usage >= 75 ? "text-yellow-600" : "text-green-600"
                      )}>
                        {Math.round(usage)}%
                      </span>
                    </div>
                    <Progress value={usage} className="h-1 mb-1" />
                    <div className="text-muted-foreground">
                      {remaining > 0 ? `${remainingHours}h ${remainingMins}m left` : 'Quota exceeded'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      
      {/* Show parents info if any parents have quotas */}
      {familyMembers.filter(member => member.role === 'parent').some(member => 
        Object.keys(quotaBalances[member.id] || {}).length > 0
      ) && (
        <div className="pt-2 border-t">
          <div className="text-sm font-medium text-muted-foreground mb-2">Parents</div>
          {familyMembers.filter(member => member.role === 'parent').map(member => {
            const memberBalances = quotaBalances[member.id] || {};
            const roomCount = Object.keys(memberBalances).length;
            
            if (roomCount === 0) return null;
            
            return (
              <div key={member.id} className="text-xs text-muted-foreground">
                {member.name}: {roomCount} room configuration{roomCount !== 1 ? 's' : ''}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Individual family member row component
 */
interface FamilyMemberRowProps {
  member: FamilyMember;
  currentUser: { id: string; role: 'parent' | 'child' | 'admin' | 'adult' | 'teen' | 'guest' };
  quotaBalances?: MemberQuotaBalances;
}

const FamilyMemberRow: React.FC<FamilyMemberRowProps> = ({ member, currentUser, quotaBalances = {} }) => {
  const canManageMembers = hasPermission(currentUser.role, FamilyPermission.MANAGE_FAMILY);
  const isCurrentUser = member.id === currentUser.id;
  
  // Calculate quota status for this member
  const quotaRoomCount = Object.keys(quotaBalances).length;
  const hasQuotaViolation = Object.values(quotaBalances).some((balance: QuotaBalance) => 
    balance && balance.status === 'exceeded'
  );
  const hasQuotaWarning = Object.values(quotaBalances).some((balance: QuotaBalance) => {
    if (!balance || !balance.totalSeconds || balance.usedSeconds === undefined) return false;
    const usage = (balance.usedSeconds / balance.totalSeconds) * 100;
    return usage >= (balance.warningThreshold || 75);
  });

  const getRoleColor = (role: string) => {
    return role === 'parent' 
      ? 'bg-blue-100 text-blue-800 border-blue-200' 
      : 'bg-green-100 text-green-800 border-green-200';
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'DECLINED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center space-x-4">
        <div className="flex flex-col flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-medium">{member.name}</span>
            {isCurrentUser && (
              <span className="text-xs text-muted-foreground">(You)</span>
            )}
            {hasQuotaViolation && (
              <AlertCircle className="h-3 w-3 text-red-500" />
            )}
            {!hasQuotaViolation && hasQuotaWarning && (
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
            )}
          </div>
          <span className="text-sm text-muted-foreground">{member.email}</span>
          {quotaRoomCount > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {quotaRoomCount} quota configuration{quotaRoomCount !== 1 ? 's' : ''}
              {hasQuotaViolation && ' • Quota exceeded'}
              {!hasQuotaViolation && hasQuotaWarning && ' • Near quota limit'}
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <Badge variant="outline" className={getRoleColor(member.role)}>
            {member.role}
          </Badge>
          {quotaRoomCount > 0 && (
            <Badge 
              variant={hasQuotaViolation ? "destructive" : hasQuotaWarning ? "secondary" : "default"}
              className="text-xs"
            >
              {hasQuotaViolation ? 'Over limit' : hasQuotaWarning ? 'Warning' : 'Normal'}
            </Badge>
          )}
          {member.invitationStatus && member.invitationStatus !== 'ACCEPTED' && (
            <Badge variant="outline" className={getStatusColor(member.invitationStatus)}>
              {member.invitationStatus}
            </Badge>
          )}
        </div>
      </div>
      
      {canManageMembers && !isCurrentUser && (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm">
            Edit
          </Button>
          <Button variant="ghost" size="sm">
            Rooms
          </Button>
          {member.invitationStatus === 'PENDING' && (
            <Button variant="ghost" size="sm">
              Resend Invite
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default FamilyDashboard;