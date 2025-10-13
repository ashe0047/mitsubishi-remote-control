"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Home, Settings, ChevronRight, Users, BarChart3, UserCog, Thermometer } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

export interface MobileDrawerProps {
  /** Is drawer currently open */
  isOpen: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Layout context (app or admin) */
  context: 'app' | 'admin';
}

// Mock function for room access
const useUserRooms = () => {
  return [
    { id: 'living-room', name: 'Living Room', deviceCount: 2, temperature: 24, isActive: true },
    { id: 'bedroom', name: 'Bedroom', deviceCount: 1, temperature: 22, isActive: false },
    { id: 'kitchen', name: 'Kitchen', deviceCount: 1, temperature: 23, isActive: true },
  ];
};

// Mock function for admin access
const hasAdminAccess = (user: unknown) => {
  return (user as { role?: string })?.role === 'parent';
};

// Mock function for admin nav items
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

// Get temperature color
const getTempColor = (temp: number) => {
  if (temp >= 26) return "text-orange-500 dark:text-orange-400";
  if (temp <= 20) return "text-blue-500 dark:text-blue-400";
  return "text-emerald-500 dark:text-emerald-400";
};

/**
 * Mobile Drawer Component
 *
 * Slide-out navigation drawer for mobile devices.
 * Renders navigation content directly in drawer.
 */
export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  context,
}) => {
  const user = useAuthStore((state) => state.user);
  const rooms = useUserRooms();
  const pathname = usePathname();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="left"
        className="w-80 p-0"
        id="mobile-navigation-drawer"
        aria-label="Main navigation"
      >
        <div className="h-full flex flex-col p-6 gap-6">
          {/* User Header */}
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
                {/* Rooms Section */}
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1 flex-shrink-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rooms</h3>
                    <Badge variant="outline" className="text-xs">{rooms.length}</Badge>
                  </div>
                  <ScrollArea className="flex-1 min-h-0 -mr-1">
                    <div className="pb-2 pr-1.5">
                      {rooms.map((room) => (
                        <Link key={room.id} href={`/app/rooms/${room.id}`} className="block mb-3" onClick={onClose}>
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
                                {/* Room icon with status */}
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
                                  {room.isActive && (
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
                                    {room.temperature && (
                                      <div className="flex items-center gap-1">
                                        <Thermometer className={cn("h-3.5 w-3.5", getTempColor(room.temperature))} />
                                        <span className={cn("text-xs font-semibold", getTempColor(room.temperature))}>
                                          {room.temperature}°C
                                        </span>
                                      </div>
                                    )}
                                    <span className="text-muted-foreground/50">•</span>
                                    <span className={cn(
                                      "text-xs font-medium",
                                      room.isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                                    )}>
                                      {room.isActive ? "Active" : "Off"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Quick Admin Access */}
                {hasAdminAccess(user) && (
                  <div className="flex-shrink-0">
                    <Link href="/admin" onClick={onClose}>
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
                  <Link href="/app" onClick={onClose}>
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

                {/* Admin Section */}
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1 flex-shrink-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administration</h3>
                    <Badge variant="outline" className="text-xs">{getAdminNavItems().length}</Badge>
                  </div>
                  <ScrollArea className="flex-1 min-h-0 -mr-1">
                    <div className="pb-2 pr-1.5">
                      {getAdminNavItems().map((item) => (
                        <Link key={item.href} href={item.href} className="block mb-3" onClick={onClose}>
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
      </SheetContent>
    </Sheet>
  );
};
