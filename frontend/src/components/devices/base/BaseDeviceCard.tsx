"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { DeviceCardHeader } from './DeviceCardHeader';
import { DeviceCardContent } from './DeviceCardContent';
import { DeviceCardFooter } from './DeviceCardFooter';
import type { ConnectionStatus } from './ConnectionStatusBadge';

export interface BaseDeviceCardProps {
  children: React.ReactNode;
  deviceName: string;
  deviceType: string;
  connectionStatus: ConnectionStatus;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  lastUpdated?: Date;
  headerActions?: React.ReactNode;
  footerActions?: React.ReactNode;
  metadata?: Record<string, string>;
}

/**
 * Base device card component providing common layout and behavior for all devices
 *
 * Features:
 * - Expand/collapse animation
 * - Connection status display
 * - Common card styling
 * - Composable header, content, and footer sections
 *
 * @example
 * ```tsx
 * <BaseDeviceCard
 *   deviceName="Living Room AC"
 *   deviceType="air-conditioner"
 *   connectionStatus="connected"
 *   isExpanded={true}
 *   onExpandToggle={() => setExpanded(!expanded)}
 * >
 *   <AirConditionerDevice />
 * </BaseDeviceCard>
 * ```
 */
export const BaseDeviceCard: React.FC<BaseDeviceCardProps> = ({
  children,
  deviceName,
  deviceType,
  connectionStatus,
  isExpanded = false,
  onExpandToggle,
  lastUpdated,
  headerActions,
  footerActions,
  metadata,
}) => {
  return (
    <Card className="overflow-hidden shadow-none">
      <DeviceCardHeader
        deviceName={deviceName}
        deviceType={deviceType}
        connectionStatus={connectionStatus}
        isExpanded={isExpanded}
        onExpandToggle={onExpandToggle}
        actions={headerActions}
      />

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <DeviceCardContent isExpanded={isExpanded}>
              {children}
            </DeviceCardContent>
          </motion.div>
        )}
      </AnimatePresence>

      <DeviceCardFooter
        lastUpdated={lastUpdated}
        actions={footerActions}
        metadata={metadata}
      />
    </Card>
  );
};
