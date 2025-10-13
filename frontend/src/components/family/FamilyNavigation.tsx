"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Home, 
  Users, 
  UserPlus, 
  Settings, 
  BarChart3,
  LogOut,
  User
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useFamilyMembers, useFamilyInvitations } from '@/stores/family-store';
import { hasPermission, FamilyPermission } from '@/types/family';
import { cn } from '@/lib/utils';

interface FamilyNavigationProps {
  className?: string;
}

/**
 * Family Navigation Component
 * Provides navigation for family management features with role-based access
 */
export const FamilyNavigation: React.FC<FamilyNavigationProps> = ({ className }) => {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const familyMembers = useFamilyMembers();
  const familyInvitations = useFamilyInvitations();

  if (!user) return null;

  const canManageFamily = hasPermission(user.role, FamilyPermission.MANAGE_FAMILY);
  const canAssignRooms = hasPermission(user.role, FamilyPermission.ASSIGN_ROOMS);
  const canManageQuotas = hasPermission(user.role, FamilyPermission.MANAGE_QUOTAS);
  const canViewUsage = hasPermission(user.role, FamilyPermission.VIEW_USAGE);


  const pendingInvitations = familyInvitations.filter(inv => inv.status === 'PENDING').length;

  const handleLogout = async () => {
    await logout();
  };

  const navigationItems = [
    // Dashboard - Always visible to parents
    ...(user.role === 'parent' ? [{
      href: '/dashboard',
      icon: Home,
      label: 'Dashboard',
      description: 'Family overview',
      available: true,
    }] : []),
    
    // Family Management
    ...(canManageFamily ? [{
      href: '/dashboard/family',
      icon: Users,
      label: 'Family Members',
      description: 'Manage family members',
      available: true,
      badge: pendingInvitations > 0 ? pendingInvitations.toString() : undefined,
    }] : []),
    
    // Room Assignments
    ...(canAssignRooms ? [{
      href: '/dashboard/rooms',
      icon: UserPlus,
      label: 'Room Assignments',
      description: 'Assign rooms to members',
      available: true,
    }] : []),
    
    // Quota Management
    ...(canManageQuotas ? [{
      href: '/quota',
      icon: Settings,
      label: 'Quota Management',
      description: 'Set up AC usage limits',
      available: true,
    }] : []),
    
    // Usage Reports
    ...(canViewUsage ? [{
      href: '/dashboard/usage',
      icon: BarChart3,
      label: 'Usage Reports',
      description: 'View family usage statistics',
      available: false, // Not implemented yet
    }] : []),
    
    // Rooms - Always available (but different access levels)
    {
      href: '/rooms',
      icon: Home,
      label: user.role === 'child' ? 'My Rooms' : 'All Rooms',
      description: user.role === 'child' ? 'Your assigned rooms' : 'All family rooms',
      available: true,
    },
  ];

  return (
    <Card className={cn("w-full max-w-sm", className)}>
      <CardContent className="p-6">
        {/* User Info */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{user.name}</div>
            <div className="text-sm text-muted-foreground truncate">{user.email}</div>
            <Badge variant="secondary" className="mt-1 text-xs">
              {user.role}
            </Badge>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const IconComponent = item.icon;
            
            return (
              <div key={item.href}>
                {item.available ? (
                  <Link href={item.href} className="block">
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start h-auto p-3",
                        isActive && "bg-primary/10 text-primary"
                      )}
                    >
                      <div className="flex items-center space-x-3 w-full">
                        <IconComponent className="h-5 w-5" />
                        <div className="flex-1 text-left">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{item.label}</span>
                            {item.badge && (
                              <Badge variant="destructive" className="h-5 min-w-[20px] text-xs">
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="ghost"
                    disabled
                    className="w-full justify-start h-auto p-3 opacity-50"
                  >
                    <div className="flex items-center space-x-3 w-full">
                      <IconComponent className="h-5 w-5" />
                      <div className="flex-1 text-left">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.description} (Coming Soon)
                        </div>
                      </div>
                    </div>
                  </Button>
                )}
              </div>
            );
          })}
        </nav>

        {/* Family Stats */}
        {user.role === 'parent' && (
          <div className="mt-6 pt-4 border-t">
            <div className="text-sm font-medium mb-2">Family Overview</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-center p-2 bg-muted rounded">
                <div className="font-medium">{familyMembers.length}</div>
                <div className="text-muted-foreground">Members</div>
              </div>
              <div className="text-center p-2 bg-muted rounded">
                <div className="font-medium">{pendingInvitations}</div>
                <div className="text-muted-foreground">Pending</div>
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <div className="mt-6 pt-4 border-t">
          <Button 
            variant="ghost" 
            onClick={handleLogout}
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

export default FamilyNavigation;