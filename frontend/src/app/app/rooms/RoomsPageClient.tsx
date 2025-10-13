"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2 } from 'lucide-react';
import RoomsList from '@/components/room/RoomList';
import { getRoleBasedPageContent } from '@/lib/utils/room-access';

/**
 * Client-side implementation of the Rooms Page
 * Handles authentication, role-based access, and room listing
 *
 * NOTE: ApiAirconProvider is NOT used here because this page lists all rooms.
 * Individual room pages (/rooms/[roomId]) should use ApiAirconProvider with the specific roomId.
 */
export default function RoomsPageClient() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Redirect unauthenticated users to login with return path
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/rooms');
      return;
    }
  }, [isAuthenticated, router]);

  // Show loading while checking auth state
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Get role-based page content
  const { title, description } = getRoleBasedPageContent(user);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <RoomsList
          title={title}
          description={description}
        />
      </div>
    </div>
  );
}