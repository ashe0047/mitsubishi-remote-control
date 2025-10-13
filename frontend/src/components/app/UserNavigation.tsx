"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export const UserNavigation: React.FC = () => {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const navItems = [
    {
      href: '/app',
      icon: Home,
      label: user?.role === 'child' ? 'My Rooms' : 'All Rooms',
    },
    {
      href: '/app/profile',
      icon: User,
      label: 'Profile',
    },
  ];

  return (
    <nav className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        {user?.role === 'parent' && (
          <Link href="/admin">
            <Button variant="outline" size="sm">
              Admin Dashboard
            </Button>
          </Link>
        )}
      </div>

      <div className="flex items-center space-x-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                className="flex items-center space-x-2"
              >
                <IconComponent className="h-4 w-4" />
                <span>{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center space-x-2">
        <Badge variant="secondary">{user?.name}</Badge>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
};