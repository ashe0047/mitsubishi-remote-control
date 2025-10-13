"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Shield, 
  AlertTriangle,
  Users,
  Settings
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// Import quota components and providers
import { QuotaWebSocketContextProvider } from '@/lib/quota/quota-websocket';
import { QuotaManagementDashboard } from '@/components/quota/QuotaManagementDashboard';

// Import auth and family stores
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission, FamilyPermission } from '@/types/family';
import { useFamilyMembers } from '@/stores/family-store';

export default function QuotaManagementPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const familyMembers = useFamilyMembers();

  // Check authentication
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You must be logged in to access quota management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Check if user has quota management permissions
  const hasQuotaAccess = user.role === 'parent' || hasPermission(user.role, FamilyPermission.MANAGE_QUOTAS);

  if (!hasQuotaAccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.back()}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Quota Management</h1>
              <p className="text-muted-foreground">Access Restricted</p>
            </div>
          </div>

          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              You don’t have permission to access quota management. Please contact a parent to request access.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.back()}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Quota Management</h1>
              <p className="text-muted-foreground">
                Manage AC usage quotas for family members
              </p>
            </div>
          </div>

          {/* User Role Badge */}
          <div className="flex items-center space-x-2">
            <Badge variant={user.role === 'parent' ? 'default' : 'secondary'}>
              <Users className="mr-1 h-3 w-3" />
              {user.role}
            </Badge>
            {user.role === 'parent' && (
              <Badge variant="outline">
                <Settings className="mr-1 h-3 w-3" />
                Admin Access
              </Badge>
            )}
          </div>
        </div>

        {/* Family Status Check */}
        {familyMembers.length === 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No family members found. You need to set up family members before creating quotas.
              <Button variant="link" className="ml-2 p-0 h-auto" onClick={() => router.push('/family')}>
                Set up family members
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Quota Management Dashboard with WebSocket Provider */}
        <QuotaWebSocketContextProvider familyMemberId={user.id}>
          <QuotaManagementDashboard />
        </QuotaWebSocketContextProvider>

        {/* Footer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About Quota Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              <h4 className="font-medium text-foreground mb-2">Features:</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>Set daily, weekly, or monthly usage limits for family members</li>
                <li>Monitor real-time AC usage and receive alerts</li>
                <li>Handle override requests for emergency or special situations</li>
                <li>Track usage history and patterns</li>
                <li>Automatic enforcement and notifications</li>
              </ul>
            </div>

            <div className="text-sm text-muted-foreground">
              <h4 className="font-medium text-foreground mb-2">Quota Types:</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Time-based:</strong> Limit by hours of AC usage per day</li>
                <li><strong>Usage-based:</strong> Limit by number of AC activations</li>
                <li><strong>Energy-based:</strong> Limit by kWh consumption</li>
                <li><strong>Cost-based:</strong> Limit by estimated energy cost</li>
              </ul>
            </div>

            {user.role === 'child' && (
              <div className="text-sm text-muted-foreground">
                <h4 className="font-medium text-foreground mb-2">Child Access:</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>View your current quota status and usage</li>
                  <li>Request override for emergency situations</li>
                  <li>Track your daily and weekly usage patterns</li>
                  <li>Receive notifications about quota limits</li>
                </ul>
              </div>
            )}

            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                Quota settings are enforced automatically and sync across all devices.
                Real-time updates require a stable internet connection.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}