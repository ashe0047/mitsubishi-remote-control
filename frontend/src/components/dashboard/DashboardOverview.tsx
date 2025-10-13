"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home, Thermometer, Power, TrendingUp, Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
// Get system stats from room data (using fallback data for now)
const getSystemStats = (rooms: any[]) => {
  const totalRooms = rooms.length;
  // For now, use mock data since we don't have real-time device status in dashboard context
  const activeDevices = Math.floor(totalRooms * 0.6); // Assume 60% are active
  const averageTemp = 24; // Default temperature
  
  return {
    totalRooms,
    activeDevices,
    averageTemp,
    energyUsage: activeDevices > totalRooms * 0.7 ? 'High' : activeDevices > totalRooms * 0.3 ? 'Normal' : 'Low',
  };
};

// Get favorite rooms from API data (using fallback data for device status)
const getFavoriteRooms = (rooms: any[]) => {
  return rooms.slice(0, 2).map((room, index) => ({
    id: room.roomIdentifier,
    name: room.name,
    temperature: 24 + (index * 2), // Mock temperatures: 24, 26
    isActive: index === 0, // First room active, second inactive
  }));
};

// Get temperature color
const getTempColor = (temp: number) => {
  if (temp >= 26) return "text-orange-500 dark:text-orange-400";
  if (temp <= 20) return "text-blue-500 dark:text-blue-400";
  return "text-emerald-500 dark:text-emerald-400";
};



export const DashboardOverview = () => {
  // Fetch rooms from API
  const rooms = useRoomStore((state) => state.rooms);
  const isLoading = useRoomStore((state) => state.isLoading);
  const fetchRooms = useRoomStore((state) => state.fetchRooms);

  // Fetch rooms on component mount
  useEffect(() => {
    if (rooms.length === 0) {
      fetchRooms();
    }
  }, [fetchRooms, rooms.length]);

  const stats = getSystemStats(rooms);
  const favoriteRooms = getFavoriteRooms(rooms);

  // Show loading state
  if (isLoading && rooms.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-8 gap-8 overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here&apos;s your home overview.</p>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        {/* Total Rooms */}
        <Card className="p-6 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Rooms</p>
              <p className="text-3xl font-bold mt-1">{stats.totalRooms}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Home className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>

        {/* Active Devices */}
        <Card className="p-6 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Devices</p>
              <p className="text-3xl font-bold mt-1">{stats.activeDevices}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Power className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        {/* Average Temperature */}
        <Card className="p-6 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Temperature</p>
              <p className={cn("text-3xl font-bold mt-1", getTempColor(stats.averageTemp))}>
                {stats.averageTemp}°C
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Thermometer className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        {/* Energy Usage */}
        <Card className="p-6 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Energy Usage</p>
              <p className="text-3xl font-bold mt-1">
                <Badge variant="outline" className="text-sm px-2 py-1">
                  {stats.energyUsage}
                </Badge>
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <Zap className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Favorite Rooms - Quick Access */}
      <div className="flex-1 min-h-0 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold">Favorite Rooms</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/rooms">View All</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {favoriteRooms.map((room) => (
            <Link key={room.id} href={`/app/rooms/${room.id}`}>
              <Card className="group overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98] shadow-none bg-muted/30 border-border/50 hover:border-border hover:bg-muted/40">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">{room.name}</h3>
                      <div className="flex items-center gap-2">
                        <Thermometer className={cn("h-4 w-4", getTempColor(room.temperature))} />
                        <span className={cn("text-2xl font-bold", getTempColor(room.temperature))}>
                          {room.temperature}°C
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center",
                      room.isActive ? "bg-green-500/10" : "bg-gray-500/10"
                    )}>
                      <Power className={cn(
                        "h-5 w-5",
                        room.isActive ? "text-green-600 dark:text-green-400 animate-pulse" : "text-gray-500"
                      )} />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Last updated: 2m ago
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {room.isActive ? 'Currently Active' : 'Currently Off'}
                    </span>
                    <Button size="sm" variant="ghost" className="text-xs">
                      Control →
                    </Button>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-auto pt-4 flex-shrink-0">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <Power className="h-4 w-4 mr-2" />
              Turn All Off
            </Button>
            <Button variant="outline" size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Eco Mode
            </Button>
            <Button variant="outline" size="sm">
              <Thermometer className="h-4 w-4 mr-2" />
              Set All to 24°C
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
