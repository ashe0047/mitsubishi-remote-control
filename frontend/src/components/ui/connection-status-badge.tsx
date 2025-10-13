"use client";

import React from 'react';
import { Wifi, WifiOff, AlertCircle, RotateCcw } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { useConnectionStatus } from '@/hooks/navigation/useConnectionStatus';
import { cn } from '@/lib/utils';

export interface ConnectionStatusBadgeProps {
  /** Show detailed status text - defaults to false for compact display */
  showDetailedStatus?: boolean;
  /** Show retry button when connection fails - defaults to true */
  showRetryButton?: boolean;
  /** Compact mode - shows only icon - defaults to false */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom click handler for the badge */
  onClick?: () => void;
  /** Hide tooltip - defaults to false */
  hideTooltip?: boolean;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = React.memo(({
  showDetailedStatus = false,
  showRetryButton = true,
  compact = false,
  className,
  onClick,
  hideTooltip = false,
}) => {
  const { status, isOnline, retryConnection, lastError } = useConnectionStatus();

  // Determine badge variant and icon based on connection status
  const getBadgeConfig = () => {
    switch (status.overall) {
      case 'healthy':
        return {
          variant: 'default' as const,
          icon: Wifi,
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
          text: 'Connected',
          description: 'WebSocket and MQTT connected',
        };
      case 'degraded':
        return {
          variant: 'secondary' as const,
          icon: AlertCircle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50 border-yellow-200',
          text: 'Degraded',
          description: 'WebSocket connected, MQTT issues',
        };
      case 'disconnected':
        return {
          variant: 'destructive' as const,
          icon: WifiOff,
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200',
          text: 'Offline',
          description: lastError || 'Connection lost',
        };
      default:
        return {
          variant: 'outline' as const,
          icon: AlertCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          text: 'Unknown',
          description: 'Connection status unknown',
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  // Format detailed status text
  const getDetailedStatus = () => {
    if (!showDetailedStatus) return config.text;

    const wsState = status.websocket.state;
    const mqttState = status.mqtt.state;
    
    if (wsState === 'connected' && mqttState === 'connected') {
      return 'All systems online';
    } else if (wsState === 'connected' && mqttState !== 'connected') {
      return `WebSocket OK, MQTT ${mqttState}`;
    } else if (wsState === 'connecting') {
      return 'Connecting...';
    } else {
      return `WebSocket ${wsState}`;
    }
  };

  // Tooltip content with detailed connection information
  const getTooltipContent = () => {
    const wsLastConnected = status.websocket.lastConnected 
      ? new Date(status.websocket.lastConnected).toLocaleTimeString()
      : 'Never';
    
    const mqttLastUpdate = status.mqtt.lastUpdate
      ? new Date(status.mqtt.lastUpdate).toLocaleTimeString()
      : 'Never';

    return (
      <div className="space-y-1 text-xs">
        <div className="font-medium">{config.description}</div>
        <div>WebSocket: {status.websocket.state} {wsLastConnected !== 'Never' && `(${wsLastConnected})`}</div>
        <div>MQTT: {status.mqtt.state} {mqttLastUpdate !== 'Never' && `(${mqttLastUpdate})`}</div>
        {status.websocket.reconnectAttempts > 0 && (
          <div>Retries: {status.websocket.reconnectAttempts}</div>
        )}
        {lastError && (
          <div className="text-red-400 mt-1">{lastError}</div>
        )}
      </div>
    );
  };

  const handleBadgeClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleRetryClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent badge click event
    retryConnection();
  };

  const badgeContent = (
    <div className="flex items-center gap-2">
      <Badge
        variant={config.variant}
        className={cn(
          'flex items-center gap-1.5 cursor-pointer transition-all duration-200',
          'hover:scale-105 active:scale-95',
          'select-none',
          config.bgColor,
          // Compact mode styling
          compact && 'px-2 py-1',
          // Click styling
          onClick && 'hover:opacity-80',
          className
        )}
        onClick={handleBadgeClick}
      >
        {/* Status icon */}
        <Icon className={cn('h-3 w-3', config.color)} />
        
        {/* Status text (hidden in compact mode) */}
        {!compact && (
          <span className="text-xs font-medium">
            {getDetailedStatus()}
          </span>
        )}
      </Badge>

      {/* Retry button (only show when connection is problematic and retry is enabled) */}
      {showRetryButton && !isOnline && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRetryClick}
          className="h-6 w-6 p-0 hover:bg-gray-100"
          disabled={status.websocket.state === 'connecting'}
          aria-label="Retry connection"
        >
          <RotateCcw 
            className={cn(
              'h-3 w-3', 
              status.websocket.state === 'connecting' && 'animate-spin'
            )} 
          />
        </Button>
      )}
    </div>
  );

  // Wrap with tooltip if not disabled and not compact
  if (!hideTooltip && !compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    );
  }

  return badgeContent;
});

ConnectionStatusBadge.displayName = 'ConnectionStatusBadge';

export default ConnectionStatusBadge;