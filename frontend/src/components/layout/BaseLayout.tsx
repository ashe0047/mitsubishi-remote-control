"use client";

import React from 'react';
import { QuotaWebSocketContextProvider } from '@/lib/quota/quota-websocket';
import { useAuthStore } from '@/stores/auth-store';
import { Toaster } from '@/components/ui/sonner';
import { ResponsiveLayout } from './ResponsiveLayout';

export interface BaseLayoutProps {
  /** Main content */
  children: React.ReactNode;
  /** Layout context (app or admin) */
  context: 'app' | 'admin';
  /** Optional title for mobile header */
  title?: string;
}

/**
 * Base Layout Component
 *
 * Shared layout structure for both app and admin contexts.
 * Eliminates code duplication between app/layout.tsx and admin/layout.tsx.
 * Provides necessary context providers and responsive layout.
 *
 * NOTE: ApiAirconProvider is NOT included here because it requires a roomId.
 * Room-specific pages should wrap their content with ApiAirconProvider and pass the roomId.
 *
 * @example
 * ```tsx
 * // In app/layout.tsx
 * export default function AppLayout({ children }) {
 *   return <BaseLayout context="app">{children}</BaseLayout>;
 * }
 * ```
 */
export const BaseLayout: React.FC<BaseLayoutProps> = ({
  children,
  context,
  title,
}) => {
  const user = useAuthStore((state) => state.user);

  return (
    <QuotaWebSocketContextProvider familyMemberId={user?.id}>
      <ResponsiveLayout context={context} title={title}>
        {children}
      </ResponsiveLayout>
      <Toaster />
    </QuotaWebSocketContextProvider>
  );
};
