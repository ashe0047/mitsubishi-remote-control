"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FamilyDashboard } from '@/components/family/FamilyDashboard';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2 } from 'lucide-react';
import { QuotaWebSocketContextProvider } from '@/lib/quota/quota-websocket';

/**
 * Main Dashboard Page - Family Overview
 * Shows comprehensive family management dashboard for authenticated users
 */
export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Redirect non-authenticated users to login
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/admin');
      return;
    }

    // Redirect children to rooms page (they don't need family management)
    if (user?.role === 'child') {
      router.push('/app');
      return;
    }
  }, [isAuthenticated, user, router]);

  // Show loading while checking auth state
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Redirect children (they shouldn't see family management)
  if (user.role === 'child') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <QuotaWebSocketContextProvider familyMemberId={user.id}>
        <FamilyDashboard />
      </QuotaWebSocketContextProvider>
    </div>
  );
}