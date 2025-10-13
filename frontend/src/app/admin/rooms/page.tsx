"use client";

import React from 'react';
import { CreateRoomDialog } from '@/components/room/CreateRoomDialog';
import { RoomManagementList } from '@/components/room/RoomManagementList';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RoomsPage() {
  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Room Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage rooms in your household
            </p>
          </div>
        </div>
        <CreateRoomDialog />
      </div>

      {/* Room list */}
      <RoomManagementList />
    </div>
  );
}
