"use client";

import React from 'react';
import { BaseLayout } from '@/components/layout/BaseLayout';

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Admin Layout Component
 * Layout for /admin routes with responsive layout in admin context
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <BaseLayout context="admin" title="Admin Dashboard">
      {children}
    </BaseLayout>
  );
}