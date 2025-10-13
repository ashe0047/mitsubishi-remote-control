"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for EmptyDeviceState component
 */
export interface EmptyDeviceStateProps {
  /** Callback when "Register Device" button clicked */
  onRegister?: () => void;
  /** Callback when "Discover Devices" button clicked */
  onDiscover?: () => void;
  /** Custom message to display (optional) */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Empty state display when no devices are found.
 * Provides call-to-action buttons for registering or discovering devices.
 *
 * @example
 * <EmptyDeviceState
 *   onRegister={handleRegister}
 *   onDiscover={handleDiscover}
 * />
 */
export const EmptyDeviceState: React.FC<EmptyDeviceStateProps> = React.memo(({
  onRegister,
  onDiscover,
  message = 'No devices found',
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
      <div className="p-8 sm:p-12 text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-muted flex items-center justify-center">
            <Search className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-semibold">
            {message}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Get started by registering a new device manually or discovering devices on your network.
          </p>
        </div>

        {/* Action Buttons */}
        {(onRegister || onDiscover) && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {onRegister && (
              <Button
                onClick={onRegister}
                className="w-full sm:w-auto min-h-[44px]"
                aria-label="Register new device"
              >
                <Plus className="h-4 w-4 mr-2" />
                Register Device
              </Button>
            )}

            {onDiscover && (
              <Button
                onClick={onDiscover}
                variant="outline"
                className="w-full sm:w-auto min-h-[44px]"
                aria-label="Discover devices"
              >
                <Search className="h-4 w-4 mr-2" />
                Discover Devices
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
});

EmptyDeviceState.displayName = 'EmptyDeviceState';

export default EmptyDeviceState;
