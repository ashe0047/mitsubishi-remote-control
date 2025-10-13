"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Settings,
  Users,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

import QuotaSetupForm, { QuotaSetupData } from './QuotaSetupForm';
import QuotaList, { QuotaData } from './QuotaList';

export interface User {
  id: string;
  name: string;
  email: string;
  isChild: boolean;
}

export interface Room {
  roomId: string;
  roomName: string;
}

export interface QuotaManagementPageProps {
  /** Available users for quota assignment */
  users: User[];
  /** Available rooms for quota scope */
  rooms: Room[];
  /** Existing quotas */
  quotas: QuotaData[];
  /** Whether the page is in loading state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** Success message to display */
  success?: string;
  /** Whether user has parent permissions */
  isParent?: boolean;
  /** Callback when quota is created */
  onCreateQuota: (data: QuotaSetupData) => Promise<void>;
  /** Callback when quota is updated */
  onUpdateQuota: (id: string, data: QuotaSetupData) => Promise<void>;
  /** Callback when quota is deleted */
  onDeleteQuota: (id: string) => Promise<void>;
  /** Callback when quota status is toggled */
  onToggleQuotaStatus: (id: string, status: 'ACTIVE' | 'PAUSED') => Promise<void>;
  /** Callback to refresh data */
  onRefresh?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export const QuotaManagementPage: React.FC<QuotaManagementPageProps> = React.memo(({
  users,
  rooms,
  quotas,
  isLoading = false,
  error,
  success,
  isParent = false,
  onCreateQuota,
  onUpdateQuota,
  onDeleteQuota,
  onToggleQuotaStatus,
  onRefresh,
  className
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'create' | 'manage'>('overview');
  const [editingQuota, setEditingQuota] = useState<QuotaData | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    const total = quotas.length;
    const active = quotas.filter(q => q.status === 'ACTIVE').length;
    const exceeded = quotas.filter(q => q.status === 'EXCEEDED').length;
    const paused = quotas.filter(q => q.status === 'PAUSED').length;

    return { total, active, exceeded, paused };
  }, [quotas]);

  const handleCreateQuota = useCallback(async (data: QuotaSetupData) => {
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');

    try {
      await onCreateQuota(data);
      setFormSuccess('Quota created successfully!');
      setActiveTab('manage'); // Switch to manage tab to show the new quota
      onRefresh?.();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create quota');
    } finally {
      setFormLoading(false);
    }
  }, [onCreateQuota, onRefresh]);

  const handleUpdateQuota = useCallback(async (data: QuotaSetupData) => {
    if (!editingQuota) return;

    setFormLoading(true);
    setFormError('');
    setFormSuccess('');

    try {
      await onUpdateQuota(editingQuota.id, data);
      setFormSuccess('Quota updated successfully!');
      setEditingQuota(null);
      setActiveTab('manage');
      onRefresh?.();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update quota');
    } finally {
      setFormLoading(false);
    }
  }, [editingQuota, onUpdateQuota, onRefresh]);

  const handleEditQuota = useCallback((quota: QuotaData) => {
    setEditingQuota(quota);
    setActiveTab('create'); // Use the same form tab for editing
    setFormError('');
    setFormSuccess('');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingQuota(null);
    setActiveTab('manage');
    setFormError('');
    setFormSuccess('');
  }, []);

  const handleDeleteQuota = useCallback(async (id: string) => {
    try {
      await onDeleteQuota(id);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to delete quota:', error);
    }
  }, [onDeleteQuota, onRefresh]);

  const handleToggleStatus = useCallback(async (id: string, status: 'ACTIVE' | 'PAUSED') => {
    try {
      await onToggleQuotaStatus(id, status);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to toggle quota status:', error);
    }
  }, [onToggleQuotaStatus, onRefresh]);

  // Clear messages when tab changes
  useEffect(() => {
    if (activeTab !== 'create') {
      setFormError('');
      setFormSuccess('');
    }
  }, [activeTab]);

  const getInitialFormData = useCallback(() => {
    if (!editingQuota) return undefined;

    return {
      userId: editingQuota.userId,
      roomId: editingQuota.roomId,
      quotaType: editingQuota.quotaType,
      allowedAmount: editingQuota.allowedAmount,
      warningThreshold: editingQuota.warningThreshold,
      effectiveFrom: editingQuota.effectiveFrom,
      effectiveUntil: editingQuota.effectiveUntil
    };
  }, [editingQuota]);

  if (!isParent) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            Only parents can manage quotas. Please contact a parent to set up or modify quotas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quota Management</h1>
          <p className="text-muted-foreground">
            Manage usage quotas for family members and rooms
          </p>
        </div>

        {onRefresh && (
          <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
            ) : null}
            Refresh
          </Button>
        )}
      </div>

      {/* Global Messages */}
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

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            {editingQuota ? <Settings className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingQuota ? 'Edit Quota' : 'Create Quota'}
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Manage Quotas
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Quotas</p>
                    <p className="text-2xl font-bold">{summaryStats.total}</p>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold text-green-600">{summaryStats.active}</p>
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
                    <p className="text-2xl font-bold text-red-600">{summaryStats.exceeded}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Paused</p>
                    <p className="text-2xl font-bold text-amber-600">{summaryStats.paused}</p>
                  </div>
                  <Settings className="h-8 w-8 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Quotas
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('manage')}
                >
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuotaList
                quotas={quotas.slice(0, 3)} // Show only first 3
                canManage={false} // No actions in overview
                onEdit={handleEditQuota}
              />
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => setActiveTab('create')}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Quota
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveTab('manage')}
              className="flex-1"
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Existing
            </Button>
          </div>
        </TabsContent>

        {/* Create/Edit Tab */}
        <TabsContent value="create">
          <QuotaSetupForm
            users={users}
            rooms={rooms}
            initialData={getInitialFormData()}
            isLoading={formLoading}
            error={formError}
            success={formSuccess}
            onSubmit={editingQuota ? handleUpdateQuota : handleCreateQuota}
            onCancel={editingQuota ? handleCancelEdit : undefined}
          />
        </TabsContent>

        {/* Manage Tab */}
        <TabsContent value="manage" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">All Quotas</h2>
            <Button
              onClick={() => {
                setEditingQuota(null);
                setActiveTab('create');
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Quota
            </Button>
          </div>

          <QuotaList
            quotas={quotas}
            isLoading={isLoading}
            canManage={true}
            onEdit={handleEditQuota}
            onDelete={handleDeleteQuota}
            onToggleStatus={handleToggleStatus}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
});

QuotaManagementPage.displayName = 'QuotaManagementPage';

export default QuotaManagementPage;