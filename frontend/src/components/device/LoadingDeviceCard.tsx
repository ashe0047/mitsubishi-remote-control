"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Props for LoadingDeviceCard component
 */
export interface LoadingDeviceCardProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton card matching DeviceCard layout.
 * Used to show loading state while fetching device data.
 *
 * @example
 * <LoadingDeviceCard />
 */
export const LoadingDeviceCard: React.FC<LoadingDeviceCardProps> = React.memo(({
  className,
}) => {
  return (
    <Card
      className={cn(
        'overflow-hidden',
        'bg-background/50 backdrop-blur-sm',
        'border border-border/40',
        'shadow-sm',
        className
      )}
    >
      <div className="p-4 sm:p-5 space-y-4">
        {/* Header Skeleton */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {/* Icon Skeleton */}
            <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex-shrink-0" />

            {/* Text Skeleton */}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32 sm:w-40" />
              <Skeleton className="h-4 w-24 sm:w-32" />
            </div>
          </div>

          {/* Badge Skeleton (Desktop) */}
          <Skeleton className="hidden sm:block h-5 w-24 flex-shrink-0" />
        </div>

        {/* Badge Skeleton (Mobile) */}
        <Skeleton className="sm:hidden h-5 w-24" />

        {/* Body Skeleton */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Footer Skeleton */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <Skeleton className="h-5 w-20" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded" />
            <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded" />
            <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded" />
          </div>
        </div>
      </div>
    </Card>
  );
});

LoadingDeviceCard.displayName = 'LoadingDeviceCard';

export default LoadingDeviceCard;
