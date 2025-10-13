"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export interface DeviceCardContentProps {
  children: React.ReactNode;
  isExpanded: boolean;
  className?: string;
}

/**
 * Content section of a device card (device-specific controls)
 * Visibility controlled by isExpanded prop
 */
export const DeviceCardContent: React.FC<DeviceCardContentProps> = ({
  children,
  isExpanded,
  className,
}) => {
  return (
    <div className={cn('p-4', !isExpanded && 'hidden', className)}>
      {children}
    </div>
  );
};
