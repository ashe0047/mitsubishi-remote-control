"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Home, Users, Settings, BarChart3, LogOut, User, ArrowLeft, UserCog
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

// Mock function for permissions - should be replaced with actual implementation
const hasPermission = (role: string, _permission: string) => {
  // For now, all parents have all permissions
  return role === 'parent';
};

export const AdminNavigation: React.FC = () => {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!user) return null;

  const navigationItems = [
    {
      href: '/admin',
      icon: Home,
      label: 'Dashboard',
      description: 'Overview and quick actions',
      available: true,
    },
    {
      href: '/admin/family',
      icon: Users,
      label: 'Family Members',
      description: 'Manage family and invitations',
      available: hasPermission(user.role, 'FAMILY_MANAGE'),
    },
    {
      href: '/admin/room-assignments',
      icon: UserCog,
      label: 'Room Assignments',
      description: 'Assign rooms to family members',
      available: hasPermission(user.role, 'ROOM_ASSIGN'),
    },
    {
      href: '/admin/quotas',
      icon: BarChart3,
      label: 'Quota Management',
      description: 'Configure usage limits',
      available: hasPermission(user.role, 'QUOTA_MANAGE'),
    },
    {
      href: '/admin/usage',
      icon: BarChart3,
      label: 'Usage Reports',
      description: 'View analytics and reports',
      available: hasPermission(user.role, 'USAGE_VIEW'),
    },
    {
      href: '/admin/settings',
      icon: Settings,
      label: 'System Settings',
      description: 'Configure system settings',
      available: hasPermission(user.role, 'SYSTEM_SETTINGS'),
    },
  ];

  return (
    <Card className="h-full border-0 rounded-none">
      <CardContent className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Admin Dashboard</h2>
            <Link href="/app">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                User App
              </Button>
            </Link>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              <Badge variant="secondary" className="mt-1 text-xs">
                {user.role}
              </Badge>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 -mr-1">
          <nav className="pr-1.5">
            {navigationItems
              .filter(item => item.available)
              .map((item) => {
                const isActive = pathname === item.href;
                const IconComponent = item.icon;

                return (
                  <Link key={item.href} href={item.href} className="block mb-3">
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className="w-full justify-start h-auto p-3"
                    >
                      <div className="flex items-center space-x-3 w-full">
                        <IconComponent className="h-5 w-5" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </Button>
                  </Link>
                );
              })}
          </nav>
        </ScrollArea>

        {/* Logout */}
        <div className="mt-8 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};