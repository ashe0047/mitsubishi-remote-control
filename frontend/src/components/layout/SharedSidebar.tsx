"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Home, Settings, ChevronRight, Menu, Users, BarChart3, UserCog, Thermometer } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useRoomStore } from '@/stores/room-store';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface SharedSidebarProps {
  context: 'app' | 'admin';
  isMobile?: boolean;
}

// Mock function for admin access - should be replaced with actual implementation
const hasAdminAccess = (user: unknown) => {
  return (user as { role?: string })?.role === 'parent';
};

// Mock function for admin nav items - should be replaced with actual implementation
const getAdminNavItems = () => {
  return [
    {
      href: '/admin/family',
      icon: Users,
      label: 'Family Members',
      description: 'Manage family accounts'
    },
    {
      href: '/admin/room-assignments',
      icon: UserCog,
      label: 'Room Assignments',
      description: 'Control room access'
    },
    {
      href: '/admin/quotas',
      icon: BarChart3,
      label: 'Quota Management',
      description: 'Set usage limits'
    },
    {
      href: '/admin/usage',
      icon: BarChart3,
      label: 'Usage Reports',
      description: 'View analytics'
    },
    {
      href: '/admin/settings',
      icon: Settings,
      label: 'System Settings',
      description: 'Configure system'
    },
  ];
};

// Get temperature color based on value
const getTempColor = (temp: number) => {
  if (temp >= 26) return "text-orange-500 dark:text-orange-400";
  if (temp <= 20) return "text-blue-500 dark:text-blue-400";
  return "text-emerald-500 dark:text-emerald-400";
};

export const SharedSidebar = ({ context, isMobile = false }: SharedSidebarProps) => {
  const user = useAuthStore((state) => state.user);
  const { rooms, isLoading, error, fetchRooms } = useRoomStore();
  const pathname = usePathname();

  // Fetch rooms on component mount
  useEffect(() => {
    if (context === 'app') {
      fetchRooms().catch((err) => {
        console.error('Failed to fetch rooms in sidebar:', err);
      });
    }
  }, [context, fetchRooms]);

  const NavigationContent = () => (
    <div className="h-full flex flex-col p-6 gap-6">
      {/* Compact User Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center ring-2 ring-primary/20">
          <Home className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base truncate">{user?.name || 'User'}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-xs px-2 py-0">
              {user?.role || 'user'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-6">

          {/* Context-aware sections */}
          {context === 'app' && (
            <>
              {/* Rooms Section - Dashboard Card Design */}
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="flex items-center justify-between px-1 flex-shrink-0">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rooms</h3>
                  <Badge variant="outline" className="text-xs">
                    {isLoading ? '...' : rooms.length}
                  </Badge>
                </div>
                <ScrollArea className="flex-1 min-h-0 -mr-1">
                  <div className="pb-2 pr-1.5">
                    {isLoading ? (
                      // Loading skeleton
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Card key={i} className="min-h-[80px] bg-muted/30 border-border/50">
                            <div className="p-3.5 flex items-center">
                              <div className="flex items-center gap-3 w-full">
                                <div className="h-11 w-11 rounded-xl bg-muted animate-pulse" />
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 bg-muted rounded animate-pulse" />
                                  <div className="h-3 bg-muted/70 rounded w-2/3 animate-pulse" />
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : error ? (
                      // Error state
                      <Card className="min-h-[80px] bg-destructive/5 border-destructive/20">
                        <div className="p-3.5 flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-sm text-destructive font-medium">Failed to load rooms</p>
                            <p className="text-xs text-muted-foreground mt-1">Check your connection</p>
                          </div>
                        </div>
                      </Card>
                    ) : rooms.length === 0 ? (
                      // Empty state
                      <Card className="min-h-[80px] bg-muted/30 border-border/50">
                        <div className="p-3.5 flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground font-medium">No rooms found</p>
                            <p className="text-xs text-muted-foreground mt-1">Contact admin to set up rooms</p>
                          </div>
                        </div>
                      </Card>
                    ) : (
                      // Rooms list
                      rooms.map((room) => {
                        const hasActiveDevices = room.aggregateStatus?.hasActiveDevices || false;
                        const averageTemp = room.aggregateStatus?.averageTemperature;
                        const deviceCount = room.aggregateStatus?.totalDevices || 0;
                        
                        return (
                          <Link key={room.id} href={`/app/rooms/${room.id}`} className="block mb-3">
                            <Card
                              className={cn(
                                "group overflow-hidden cursor-pointer transition-all duration-200 min-h-[80px]",
                                "active:scale-[0.98] shadow-none",
                                pathname === `/app/rooms/${room.id}`
                                  ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                                  : "bg-muted/30 border-border/50 hover:border-border hover:bg-muted/40"
                              )}
                            >
                              <div className="p-3.5 flex items-center">
                                <div className="flex items-center gap-3 w-full">
                                  {/* Room icon with status indicator */}
                                  <div className="relative flex-shrink-0">
                                    <div className={cn(
                                      "h-11 w-11 rounded-xl flex items-center justify-center transition-colors",
                                      pathname === `/app/rooms/${room.id}`
                                        ? "bg-primary/10"
                                        : "bg-muted/70 group-hover:bg-muted"
                                    )}>
                                      <Home className={cn(
                                        "h-5 w-5 transition-colors",
                                        pathname === `/app/rooms/${room.id}`
                                          ? "text-primary"
                                          : "text-muted-foreground"
                                      )} />
                                    </div>
                                    {hasActiveDevices && (
                                      <div className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
                                    )}
                                  </div>

                                  {/* Room info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <h4 className="font-medium text-sm truncate">{room.name}</h4>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      {/* Temperature */}
                                      {averageTemp && (
                                        <div className="flex items-center gap-1">
                                          <Thermometer className={cn("h-3.5 w-3.5", getTempColor(averageTemp))} />
                                          <span className={cn("text-xs font-semibold", getTempColor(averageTemp))}>
                                            {Math.round(averageTemp)}°C
                                          </span>
                                        </div>
                                      )}
                                      {averageTemp && <span className="text-muted-foreground/50">•</span>}
                                      {/* Status */}
                                      <span className={cn(
                                        "text-xs font-medium",
                                        hasActiveDevices ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                                      )}>
                                        {hasActiveDevices ? "Active" : "Off"}
                                      </span>
                                      {deviceCount > 0 && (
                                        <>
                                          <span className="text-muted-foreground/50">•</span>
                                          <span className="text-xs text-muted-foreground">
                                            {deviceCount} device{deviceCount !== 1 ? 's' : ''}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
            </div>

            {/* Quick Admin Access - Only for users with admin permissions */}
            {hasAdminAccess(user) && (
                <div className="flex-shrink-0">
                  <Link href="/admin">
                    <Card className="group overflow-hidden cursor-pointer transition-all duration-200 bg-muted/30 border-border/50 hover:border-border hover:bg-muted/40 active:scale-[0.98] shadow-none">
                      <div className="p-3.5 flex items-center">
                        <div className="flex items-center gap-3 w-full">
                          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Settings className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-medium text-sm">Admin Dashboard</h4>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Manage system settings</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </div>
              )}
            </>
          )}

          {context === 'admin' && (
            <>
              {/* Quick App Access */}
              <div className="flex-shrink-0">
                <Link href="/app">
                  <Card className="group overflow-hidden cursor-pointer transition-all duration-200 bg-muted/30 border-border/50 hover:border-border hover:bg-muted/40 active:scale-[0.98] shadow-none">
                    <div className="p-3.5 flex items-center">
                      <div className="flex items-center gap-3 w-full">
                        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Home className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-medium text-sm">Back to App</h4>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">Control your devices</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>

              {/* Admin Section - Dashboard Card Design */}
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="flex items-center justify-between px-1 flex-shrink-0">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administration</h3>
                  <Badge variant="outline" className="text-xs">{getAdminNavItems().length}</Badge>
                </div>
                <ScrollArea className="flex-1 min-h-0 -mr-1">
                  <div className="pb-2 pr-1.5">
                    {getAdminNavItems().map((item) => (
                      <Link key={item.href} href={item.href} className="block mb-3">
                        <Card
                          className={cn(
                            "group overflow-hidden cursor-pointer transition-all duration-200 min-h-[80px]",
                            "active:scale-[0.98] shadow-none",
                            pathname === item.href
                              ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                              : "bg-muted/30 border-border/50 hover:border-border hover:bg-muted/40"
                          )}
                        >
                          <div className="p-3.5 flex items-center">
                            <div className="flex items-center gap-3 w-full">
                              <div className={cn(
                                "h-11 w-11 rounded-xl flex items-center justify-center transition-colors flex-shrink-0",
                                pathname === item.href
                                  ? "bg-primary/10"
                                  : "bg-muted/70 group-hover:bg-muted"
                              )}>
                                <item.icon className={cn(
                                  "h-5 w-5 transition-colors",
                                  pathname === item.href
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                )} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="font-medium text-sm truncate">{item.label}</h4>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
      </div>
    </div>
  );

  // Mobile: Sheet overlay, Desktop: Fixed sidebar with full viewport height
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <NavigationContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="w-80 h-screen p-3">
      <Card className="h-full overflow-hidden bg-card border shadow-none">
        <NavigationContent />
      </Card>
    </aside>
  );
};

export default SharedSidebar;
