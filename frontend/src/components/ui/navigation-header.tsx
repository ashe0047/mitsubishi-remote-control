"use client";

import React from 'react';
import { BackButton } from './back-button';
import { ConnectionStatusBadge } from './connection-status-badge';
import { cn } from '@/lib/utils';

export interface NavigationHeaderProps {
  /** Page title to display */
  title?: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Show back button - defaults to true */
  showBackButton?: boolean;
  /** Show connection status badge - defaults to true */
  showConnectionStatus?: boolean;
  /** Fallback route for back button navigation */
  backButtonFallback?: string;
  /** Custom back button label */
  backButtonLabel?: string;
  /** Show detailed connection status in badge */
  showDetailedStatus?: boolean;
  /** Compact mode for smaller screens */
  compact?: boolean;
  /** Custom content to render in the header */
  children?: React.ReactNode;
  /** Additional CSS classes for the header container */
  className?: string;
  /** Additional CSS classes for the title */
  titleClassName?: string;
  /** Custom click handler for back button */
  onBackClick?: () => void;
  /** Custom click handler for connection status badge */
  onConnectionStatusClick?: () => void;
  /** Sticky header positioning */
  sticky?: boolean;
  /** Show border at bottom of header */
  showBorder?: boolean;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = React.memo(({
  title,
  subtitle,
  showBackButton = true,
  showConnectionStatus = true,
  backButtonFallback = '/',
  backButtonLabel = 'Back',
  showDetailedStatus = false,
  compact = false,
  children,
  className,
  titleClassName,
  onBackClick,
  onConnectionStatusClick,
  sticky = false,
  showBorder = true,
}) => {
  return (
    <header
      className={cn(
        'flex items-center justify-between p-4 bg-white',
        // Sticky positioning
        sticky && 'sticky top-0 z-50',
        // Border styling
        showBorder && 'border-b border-gray-200',
        // Mobile optimization
        'min-h-[64px] gap-3',
        // Shadow when sticky
        sticky && 'shadow-sm',
        className
      )}
    >
      {/* Left section - Back button and title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {showBackButton && (
          <BackButton
            fallbackRoute={backButtonFallback}
            label={backButtonLabel}
            showLabel={!compact}
            {...(onBackClick && { onClick: onBackClick })}
            className="flex-shrink-0"
          />
        )}
        
        {(title || subtitle || children) && (
          <div className="flex-1 min-w-0">
            {title && (
              <h1
                className={cn(
                  'font-semibold text-gray-900 truncate',
                  compact ? 'text-lg' : 'text-xl',
                  titleClassName
                )}
              >
                {title}
              </h1>
            )}
            
            {subtitle && !compact && (
              <p className="text-sm text-gray-600 truncate mt-0.5">
                {subtitle}
              </p>
            )}
            
            {/* Custom content slot */}
            {children && (
              <div className="mt-1">
                {children}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right section - Connection status */}
      {showConnectionStatus && (
        <div className="flex-shrink-0">
          <ConnectionStatusBadge
            showDetailedStatus={showDetailedStatus}
            compact={compact}
            onClick={onConnectionStatusClick}
            className="ml-2"
          />
        </div>
      )}
    </header>
  );
});

NavigationHeader.displayName = 'NavigationHeader';

export default NavigationHeader;