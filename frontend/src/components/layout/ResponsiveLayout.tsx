"use client";

import React, { useState } from 'react';
import { useResponsive } from '@/hooks/responsive';
import { MobileHeader, MobileDrawer } from './mobile';
import { SharedSidebar } from './SharedSidebar';
import { ResponsiveContainer } from './ResponsiveContainer';

export interface ResponsiveLayoutProps {
  /** Main content */
  children: React.ReactNode;
  /** Layout context (app or admin) */
  context: 'app' | 'admin';
  /** Optional title for mobile header */
  title?: string;
  /** Optional header actions */
  headerActions?: React.ReactNode;
}

/**
 * Responsive Layout Component
 *
 * Orchestrates responsive behavior using Strategy Pattern.
 * Renders mobile navigation (drawer) or desktop sidebar based on breakpoint.
 *
 * @example
 * ```tsx
 * <ResponsiveLayout context="app" title="My App">
 *   <YourContent />
 * </ResponsiveLayout>
 * ```
 */
export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  context,
  title,
  headerActions,
}) => {
  const { isMobile } = useResponsive();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Mobile Strategy: Header + Drawer
  if (isMobile) {
    return (
      <>
        <MobileHeader
          title={title}
          onMenuClick={() => setIsDrawerOpen(true)}
          isMenuOpen={isDrawerOpen}
          actions={headerActions}
        />
        <MobileDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          context={context}
        />
        <main className="flex-1">
          <ResponsiveContainer maxWidth="full" padding="md">
            {children}
          </ResponsiveContainer>
        </main>
      </>
    );
  }

  // Desktop Strategy: Fixed Sidebar
  return (
    <div className="flex h-screen bg-background">
      <SharedSidebar context={context} />
      <main className="flex-1 overflow-auto">
        <ResponsiveContainer maxWidth="2xl" padding="lg">
          {children}
        </ResponsiveContainer>
      </main>
    </div>
  );
};
