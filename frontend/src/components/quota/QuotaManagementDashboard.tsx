"use client";

import React, { useState, useEffect, useContext } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Settings, 
  Bell, 
  Users,
  AlertTriangle,
  CheckCircle,
  Activity 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import quota types
import { OverrideRequestType, OverrideUrgency, QuotaWizardData } from '@/types/quota';
import { CreateQuotaRequest, useQuotaApi } from '@/lib/api/quota-client';

// Import quota components
import { QuotaSetupWizard } from './QuotaSetupWizard';
import { QuotaUsageTracker } from './QuotaUsageTracker';
import { useRoomStore } from '@/stores/room-store';
import { QuotaStatusWidget } from './QuotaStatusWidget.optimized';
import { QuotaOverrideRequest, OverrideRequestList, OverrideRequest } from './QuotaOverrideRequest';

// Import WebSocket hooks
import { 
  useQuotaWebSocketContext
} from '@/lib/quota/quota-websocket';

// Import stores and auth
import { useAuthStore } from '@/stores/auth-store';
import { useUserViolations } from '@/stores/quota-store';

interface QuotaManagementDashboardProps {
  className?: string;
}

export const QuotaManagementDashboard: React.FC<QuotaManagementDashboardProps> = ({
  className,
}) => {
  const user = useAuthStore((state) => state.user);
  
  // Local state
  const [activeTab, setActiveTab] = useState('overview');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedQuota, setSelectedQuota] = useState<string | null>(null);

  // WebSocket context for real-time updates
  const {
    isConnected,
  } = useQuotaWebSocketContext();

  // Get rooms from API
  const rooms = useRoomStore((state) => state.rooms);
  const fetchRooms = useRoomStore((state) => state.fetchRooms);

  // Fetch rooms on component mount
  useEffect(() => {
    if (rooms.length === 0) {
      fetchRooms();
    }
  }, [fetchRooms, rooms.length]);

  // Transform API room data to match expected format
  const transformedRooms = rooms.map(room => ({
    roomName: room.name,
    roomId: room.roomIdentifier,
  }));

  // Get violation alerts from quota store
  const violationAlerts = useUserViolations(user?.id || '');

  // Placeholder functions for override management (to be implemented)
  const subscribe = (quotaId: string) => {
    console.log('Subscribe to quota:', quotaId);
  };
  const unsubscribe = (quotaId: string) => {
    console.log('Unsubscribe from quota:', quotaId);
  };
  const requestOverride = (requestId: string, duration?: number, reason?: string) => {
    console.log('Override request:', { requestId, duration, reason });
  };
  const approveOverride = (requestId: string, duration?: number, reason?: string) => {
    console.log('Override approval:', { requestId, duration, reason });
  };
  const rejectOverride = (requestId: string, reason: string) => {
    console.log('Override rejection:', { requestId, reason });
  };

  // Mock data - replace with actual API calls
  type QuotaItem = {
    id: string;
    familyMemberId: string;
    familyMemberName: string;
    roomId: string;
    roomName: string;
    quotaType: 'TIME_BASED' | 'USAGE_BASED' | 'ENERGY_BASED' | 'COST_BASED';
    dailyLimit: number;
    currentUsage: number;
    status: 'ACTIVE' | 'WARNING' | 'EXCEEDED' | 'PAUSED';
    warningThreshold: number;
    resetTime: string;
  };

  const [quotas] = useState<QuotaItem[]>([
    {
      id: 'quota-1',
      familyMemberId: 'child-1',
      familyMemberName: 'Alex',
      roomId: 'living-room',
      roomName: 'Living Room',
      quotaType: 'TIME_BASED' as const,
      dailyLimit: 3 * 3600, // 3 hours
      currentUsage: 1.5 * 3600, // 1.5 hours
      status: 'ACTIVE' as const,
      warningThreshold: 75,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'quota-2',
      familyMemberId: 'child-2',
      familyMemberName: 'Sam',
      roomId: 'kids-room-1',
      roomName: 'Kids Room 1',
      quotaType: 'TIME_BASED' as const,
      dailyLimit: 2 * 3600, // 2 hours
      currentUsage: 2.2 * 3600, // 2.2 hours (exceeded)
      status: 'EXCEEDED' as const,
      warningThreshold: 75,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  // Mock override requests
  const [mockOverrideRequests] = useState<OverrideRequest[]>([
    {
      id: 'req-1',
      quotaId: 'quota-2',
      familyMemberId: 'child-2',
      familyMemberName: 'Sam',
      roomId: 'kids-room-1',
      roomName: 'Kids Room 1',
      requestType: 'TIME_EXTENSION',
      duration: 60,
      reason: 'Need to finish homework on computer, very important assignment due tomorrow.',
      urgency: 'HIGH',
      status: 'PENDING',
      requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'req-2',
      quotaId: 'quota-1',
      familyMemberId: 'child-1',
      familyMemberName: 'Alex',
      roomId: 'living-room',
      roomName: 'Living Room',
      requestType: 'EMERGENCY_OVERRIDE',
      duration: 120,
      reason: 'Feeling very sick and need to rest in cool room.',
      urgency: 'EMERGENCY',
      status: 'APPROVED',
      requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      respondedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      approvedBy: user?.id,
      responseReason: 'Approved for health reasons.',
    },
  ]);

  // Subscribe to quota updates
  useEffect(() => {
    quotas.forEach(quota => {
      subscribe(quota.id);
    });

    return () => {
      quotas.forEach(quota => {
        unsubscribe(quota.id);
      });
    };
  }, [quotas, subscribe, unsubscribe]);

  const handleCreateQuota = async (quotaData: unknown) => {
    console.log('Creating quota:', quotaData);

    try {
      const wizardData = quotaData as QuotaWizardData;

      if (!wizardData.quotaType || !wizardData.quotaConfig || !wizardData.familyMembers || !wizardData.roomSelection) {
        throw new Error('Incomplete quota configuration data');
      }

      const { quotaType, quotaConfig, familyMembers, roomSelection } = wizardData;

      // Determine the quota type for API
      const apiQuotaType = quotaType.type === 'USAGE_BASED' ? 'USAGE_COUNT' : quotaType.type;

      // Calculate allowed amount based on quota type
      let allowedAmount: number;
      switch (quotaType.type) {
        case 'TIME_BASED':
          allowedAmount = quotaConfig.dailyLimitSeconds || 3600; // Default 1 hour
          break;
        case 'USAGE_BASED':
          allowedAmount = quotaConfig.dailyLimitUsages || 10; // Default 10 uses
          break;
        case 'ENERGY_BASED':
          allowedAmount = quotaConfig.dailyLimitKwh || 5.0; // Default 5 kWh
          break;
        case 'COST_BASED':
          allowedAmount = quotaConfig.dailyLimitAmount || 50.0; // Default $50
          break;
        default:
          allowedAmount = 3600; // Default to 1 hour
      }

      const warningThreshold = quotaConfig.warningThreshold || 80; // Default 80%

      // Get selected rooms (either specific rooms or all rooms)
      const targetRooms = roomSelection.applyToAll
        ? transformedRooms.map(room => room.roomId)
        : roomSelection.selectedRooms;

      // Create quotas for each member/room combination
      const quotaApi = useQuotaApi();
      const creationPromises = [];

      for (const memberId of familyMembers.selectedMembers) {
        for (const roomId of targetRooms) {
          const createRequest: CreateQuotaRequest = {
            userId: memberId,
            roomId: roomId,
            quotaType: apiQuotaType as "TIME_BASED" | "USAGE_COUNT" | "ENERGY_BASED" | "COST_BASED",
            allowedAmount: allowedAmount,
            warningThreshold: warningThreshold
          };

          creationPromises.push(quotaApi.createQuota(createRequest));
        }
      }

      // Execute all quota creations
      await Promise.all(creationPromises);

      console.log(`Successfully created ${creationPromises.length} quotas`);
      setShowWizard(false);

      // TODO: Show success notification to user
      // TODO: Refresh quotas list - this would typically be handled by WebSocket updates

    } catch (error) {
      console.error('Failed to create quota:', error);
      // TODO: Show error notification to user
      // Error handling is managed at the component level for now
    }
  };

  const handleOverrideRequest = async (requestData: {
    requestType: OverrideRequestType;
    duration: number;
    reason: string;
    urgency: OverrideUrgency;
  }) => {
    console.log('Submitting override request:', requestData);
    // The WebSocket hook will handle sending the request
    requestOverride({
      quotaId: selectedQuota!,
      ...requestData,
    });
  };

  const handleApproveOverride = async (requestId: string, duration?: number, reason?: string) => {
    console.log('Approving override:', requestId);
    approveOverride(requestId, duration, reason);
  };

  const handleRejectOverride = async (requestId: string, reason: string) => {
    console.log('Rejecting override:', requestId, reason);
    rejectOverride(requestId, reason);
  };

  const getQuotaStats = () => {
    const total = quotas.length;
    const active = quotas.filter(q => q.status === 'ACTIVE').length;
    const warning = quotas.filter(q => q.status === 'WARNING').length;
    const exceeded = quotas.filter(q => q.status === 'EXCEEDED').length;
    
    return { total, active, warning, exceeded };
  };

  const stats = getQuotaStats();
  const pendingRequests = mockOverrideRequests.filter(r => r.status === 'PENDING').length;
  const recentAlerts = violationAlerts.slice(0, 5);
  const isParent = user?.role === 'parent';

  return (
    <div className={cn("space-y-6", className)}>
      {/* Connection Status */}
      {!isConnected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Real-time quota updates are currently unavailable. Some features may not work correctly.
          </AlertDescription>
        </Alert>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Quotas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{stats.active}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <div>
                <div className="text-2xl font-bold">{stats.exceeded}</div>
                <div className="text-xs text-muted-foreground">Exceeded</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-amber-600" />
              <div>
                <div className="text-2xl font-bold">{pendingRequests}</div>
                <div className="text-xs text-muted-foreground">Pending Requests</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="requests">
              Override Requests
              {pendingRequests > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingRequests}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            {isParent && <TabsTrigger value="manage">Manage</TabsTrigger>}
          </TabsList>

          {isParent && !showWizard && (
            <Button onClick={() => setShowWizard(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Quota
            </Button>
          )}
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {quotas.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No quotas configured</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by creating your first quota to manage AC usage.
                </p>
                {isParent && (
                  <Button onClick={() => setShowWizard(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Quota
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {quotas.map((quota) => (
                <div key={quota.id} className="space-y-4">
                  {/* Quota Status Widget */}
                  <QuotaStatusWidget
                    quotaId={quota.id}
                    familyMemberId={quota.familyMemberId}
                    familyMemberName={quota.familyMemberName}
                    roomId={quota.roomId}
                    roomName={quota.roomName}
                    quotaType={quota.quotaType}
                    currentUsage={quota.currentUsage}
                    dailyLimit={quota.dailyLimit}
                    status={quota.status}
                    warningThreshold={quota.warningThreshold}
                    showOverrideButton={!isParent}
                    onOverrideClick={() => setSelectedQuota(quota.id)}
                  />

                  {/* Real-time Usage Tracker */}
                  <QuotaUsageTracker
                    quotaId={quota.id}
                    familyMemberId={quota.familyMemberId}
                    roomId={quota.roomId}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Override Request Form (if quota selected) */}
          {selectedQuota && !isParent && (
            <Card>
              <CardHeader>
                <CardTitle>Request Quota Override</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute top-4 right-4"
                  onClick={() => setSelectedQuota(null)}
                >
                  ×
                </Button>
              </CardHeader>
              <CardContent>
                {(() => {
                  const quota = quotas.find(q => q.id === selectedQuota);
                  if (!quota) return null;
                  
                  return (
                    <QuotaOverrideRequest
                      quotaId={quota.id}
                      familyMemberId={quota.familyMemberId}
                      familyMemberName={quota.familyMemberName}
                      roomId={quota.roomId}
                      roomName={quota.roomName}
                      currentUsage={quota.currentUsage}
                      dailyLimit={quota.dailyLimit}
                      quotaType={quota.quotaType}
                      onRequestSubmit={handleOverrideRequest}
                    />
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Override Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Override Requests</span>
                {pendingRequests > 0 && (
                  <Badge variant="secondary">{pendingRequests} pending</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isParent 
                  ? 'Review and respond to override requests from family members'
                  : 'View your override request history and status'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OverrideRequestList
                requests={mockOverrideRequests}
                showActions={isParent}
                onApprove={handleApproveOverride}
                onReject={handleRejectOverride}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Recent Alerts</span>
              </CardTitle>
              <CardDescription>
                Quota violations and system notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No recent alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAlerts.map((alert, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {alert.violationType.replace('_', ' ')} - {alert.familyMemberName}
                          </div>
                          <div className="text-sm">
                            {alert.roomName} • {new Date(alert.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manage Tab (Parents only) */}
        {isParent && (
          <TabsContent value="manage" className="space-y-6">
            {showWizard ? (
              <QuotaSetupWizard
                onComplete={handleCreateQuota}
                onCancel={() => setShowWizard(false)}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>Quota Management</span>
                  </CardTitle>
                  <CardDescription>
                    Create and configure quotas for family members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Quota Management</h3>
                    <p className="text-muted-foreground mb-4">
                      Configure quotas, set limits, and manage family member access to AC units.
                    </p>
                    <Button onClick={() => setShowWizard(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create New Quota
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default QuotaManagementDashboard;