"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RoomAssignmentInterface } from '@/components/family/RoomAssignmentInterface';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission, FamilyPermission } from '@/types/family';
import { Loader2 } from 'lucide-react';

/**
 * Room Assignment Management Page
 * Provides interface for parents to assign rooms to family members
 */
export default function RoomAssignmentPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const canAssignRooms = user && hasPermission(user.role, FamilyPermission.ASSIGN_ROOMS);

  useEffect(() => {
    // Redirect non-authenticated users to login
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/admin/room-assignments');
      return;
    }

    // Redirect users without room assignment permissions
    if (user && !canAssignRooms) {
      router.push('/app');
      return;
    }
  }, [isAuthenticated, user, canAssignRooms, router]);

  // Show loading while checking auth state
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Redirect users without permissions
  if (!canAssignRooms) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Room Assignment</h1>
        <p className="text-muted-foreground">
          Manage which rooms each family member can access and their permission levels
        </p>
      </div>
      <RoomAssignmentInterface />
    </div>
  );
}