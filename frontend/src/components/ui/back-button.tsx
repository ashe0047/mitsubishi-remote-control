"use client";

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { useNavigateBack } from '@/hooks/navigation/useNavigateBack';
import { cn } from '@/lib/utils';

export interface BackButtonProps {
  /** Fallback route to navigate to if browser history is empty */
  fallbackRoute?: string;
  /** Button variant - defaults to 'ghost' for minimal appearance */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /** Button size - defaults to 'sm' for compact navigation */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Show text label alongside icon - defaults to false */
  showLabel?: boolean;
  /** Custom label text - defaults to 'Back' */
  label?: string;
  /** Show tooltip on hover - defaults to true */
  showTooltip?: boolean;
  /** Custom tooltip text */
  tooltipText?: string;
  /** Additional CSS classes */
  className?: string;
  /** Disable the button */
  disabled?: boolean;
  /** Custom click handler - will override default navigation */
  onClick?: () => void;
  /** Loading state - shows spinner */
  loading?: boolean;
}

export const BackButton: React.FC<BackButtonProps> = React.memo(({
  fallbackRoute = '/',
  variant = 'ghost',
  size = 'sm',
  showLabel = false,
  label = 'Back',
  showTooltip = true,
  tooltipText,
  className,
  disabled = false,
  onClick,
  loading = false,
  ...props
}) => {
  const { navigateBack, isNavigating } = useNavigateBack({
    fallbackRoute,
    confirmNavigation: false, // No confirmation needed for back button
  });

  const handleClick = React.useCallback(() => {
    if (disabled || isNavigating) {
      return;
    }

    if (onClick) {
      onClick();
    } else {
      navigateBack();
    }
  }, [disabled, isNavigating, onClick, navigateBack]);

  const isLoading = loading || isNavigating;
  const isDisabled = disabled || isLoading;

  const buttonContent = (
    <Button
      variant={variant}
      size={size}
      disabled={isDisabled}
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 transition-all duration-200',
        'hover:scale-105 active:scale-95',
        'focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
        // Mobile touch targets
        'min-h-[44px] min-w-[44px]',
        className
      )}
      aria-label={showLabel ? undefined : (tooltipText || `${label} navigation`)}
      {...props}
    >
      {/* Loading spinner or back arrow icon */}
      {isLoading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
      ) : (
        <ArrowLeft className="h-4 w-4" />
      )}
      
      {/* Optional text label */}
      {showLabel && (
        <span className="hidden sm:inline-block font-medium">
          {label}
        </span>
      )}
    </Button>
  );

  // Wrap with tooltip if enabled and no label is shown  
  if (showTooltip && !showLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {buttonContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText || `${label} to previous page`}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return buttonContent;
});

BackButton.displayName = 'BackButton';

export default BackButton;