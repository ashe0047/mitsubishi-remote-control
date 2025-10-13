"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  /** Maximum width constraint */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Responsive padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Additional className */
  className?: string;
}

/**
 * Responsive Container Component
 *
 * Provides responsive padding and max-width constraints for content areas.
 * Follows mobile-first approach with increasing padding at larger breakpoints.
 *
 * @example
 * ```tsx
 * <ResponsiveContainer maxWidth="xl" padding="md">
 *   <YourContent />
 * </ResponsiveContainer>
 * ```
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  maxWidth = 'xl',
  padding = 'md',
  className,
}) => {
  // Max-width classes
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };

  // Responsive padding classes (mobile-first)
  const paddingClasses = {
    none: '',
    sm: 'px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6',
    md: 'px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8',
    lg: 'px-6 py-6 sm:px-8 sm:py-8 md:px-12 md:py-12',
  };

  return (
    <div
      className={cn(
        'w-full mx-auto',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
};
