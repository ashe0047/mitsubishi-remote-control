"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FamilyMemberManagement } from '@/components/family/FamilyMemberManagement';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission, FamilyPermission } from '@/types/family';
import { Loader2 } from 'lucide-react';

/**
 * Family Management Page
 * Provides interface for parents to manage family members and invitations
 */
export default function FamilyManagementPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const canManageFamily = user && hasPermission(user.role, FamilyPermission.MANAGE_FAMILY);

  useEffect(() => {
    // Redirect non-authenticated users to login
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/admin/family');
      return;
    }

    // Redirect users without family management permissions
    if (user && !canManageFamily) {
      router.push('/app');
      return;
    }
  }, [isAuthenticated, user, canManageFamily, router]);

  // Show loading while checking auth state
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Redirect users without permissions
  if (!canManageFamily) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Family Management</h1>
        <p className="text-muted-foreground">
          Add, remove, and manage family members and their invitations
        </p>
      </div>
      <FamilyMemberManagement />
    </div>
  );
}