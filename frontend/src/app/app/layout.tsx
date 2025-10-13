"use client";

import React from 'react';
import { BaseLayout } from '@/components/layout/BaseLayout';

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * App Layout Component
 * Layout for /app routes with responsive layout in app context
 */
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <BaseLayout context="app" title="Smart Home">
      {children}
    </BaseLayout>
  );
}