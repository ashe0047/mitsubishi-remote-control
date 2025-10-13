"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MobileHeaderProps {
  /** Title to display in header */
  title?: string;
  /** Callback when menu button clicked */
  onMenuClick: () => void;
  /** Is menu currently open */
  isMenuOpen?: boolean;
  /** Additional actions to display in header */
  actions?: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Mobile Header Component
 *
 * Top navigation bar for mobile devices with hamburger menu button.
 * Fixed to top of viewport for easy access.
 *
 * @example
 * ```tsx
 * <MobileHeader
 *   title="My App"
 *   onMenuClick={() => setMenuOpen(true)}
 *   actions={<NotificationButton />}
 * />
 * ```
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  onMenuClick,
  isMenuOpen = false,
  actions,
  className,
}) => {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
    >
      <div className="flex h-14 items-center px-4 gap-4">
        {/* Hamburger Menu Button - 44x44px minimum */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation-drawer"
          className="h-11 w-11 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Title */}
        {title && (
          <h1 className="flex-1 text-base font-semibold truncate md:text-lg">
            {title}
          </h1>
        )}

        {/* Header Actions */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};
