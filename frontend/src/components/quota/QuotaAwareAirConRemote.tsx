"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Power,
  Thermometer,
  Wind,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Shield,
  Clock,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import quota components
import QuotaStatusBadge from './QuotaStatusBadge';
import QuotaWarningModal from './QuotaWarningModal';
import QuotaUsageCard from './QuotaUsageCard';

// Import existing AC functionality
import { useAirconStore } from '@/hooks/useAirconStore';
import { ApiAirconStoreState } from '@/stores/api-aircon-store';
import { 
  useUserQuotaBalance,
  useQuotaStore
} from '@/stores/quota-store';

// Import WebSocket hook
import { useQuotaWebSocketConnection } from '@/hooks/useQuoteWebsocket';

export interface QuotaAwareAirConRemoteProps {
  roomId: string;
  /** User ID for quota tracking */
  userId: string;
  /** Show detailed quota information */
  showQuotaDetails?: boolean;
  /** Allow quota override requests */
  allowOverrideRequests?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Enhanced Air Conditioner Remote with integrated quota management.
 * Prevents AC operation when quotas are exceeded and shows usage warnings.
 */
export const QuotaAwareAirConRemote: React.FC<QuotaAwareAirConRemoteProps> = React.memo(({
  roomId,
  userId,
  showQuotaDetails = true,
  allowOverrideRequests = true,
  className
}) => {
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [, setPendingCommand] = useState<(() => void) | null>(null);
  const [estimatedUsage, setEstimatedUsage] = useState(0);

  // AC store hooks
  const roomState = useAirconStore((state: ApiAirconStoreState) => state.rooms[roomId]);
  const setTemperatureCmd = useAirconStore((state: ApiAirconStoreState) => state.setTemperature);
  const setModeCmd = useAirconStore((state: ApiAirconStoreState) => state.setMode);
  const setFanCmd = useAirconStore((state: ApiAirconStoreState) => state.setFan);
  const isConnected = useAirconStore((state: ApiAirconStoreState) => state.isConnected);

  // Quota store hooks
  const balance = useUserQuotaBalance(userId, roomId);
  const wouldExceedQuota = useQuotaStore(state => state.wouldExceedQuota);
  const isQuotaAtWarningLevel = useQuotaStore(state => state.isQuotaAtWarningLevel);
  const hasActiveViolation = useQuotaStore(state => state.hasActiveViolation);
  const hasActiveOverride = useQuotaStore(state => state.hasActiveOverride);

  // WebSocket connection for real-time updates
  const { isConnected: quotaConnected } = useQuotaWebSocketConnection();

  const currentSettings = roomState?.settings;
  const isPowerOn = currentSettings?.mode !== 'off';

  // Check if operation is blocked due to quota
  const isBlocked = useMemo(() => {
    if (!balance) return false;
    
    // Check for active violations that block usage
    if (hasActiveViolation(userId, roomId)) {
      const violations = useQuotaStore.getState().getViolationsForUser(userId);
      const roomViolation = violations.find(v => 
        v.roomId === roomId && (v.type === 'BLOCKED' || v.type === 'EXCEEDED')
      );
      
      // Only block if no override is active
      return roomViolation && !hasActiveOverride(userId, roomId);
    }
    
    return balance.isExceeded && !balance.hasOverride;
  }, [balance, hasActiveViolation, hasActiveOverride, userId, roomId]);

  // Estimate usage impact for operations
  useEffect(() => {
    if (currentSettings?.mode !== 'off') {
      // Estimate 30 minutes of usage for demonstration
      setEstimatedUsage(30 * 60); // 30 minutes in seconds
    } else {
      setEstimatedUsage(0);
    }
  }, [currentSettings?.mode]);

  // Handle quota-aware command sending
  const sendQuotaAwareCommand = useCallback(async (command: () => void, operation: string) => {
    if (!balance) {
      // No quota configured, send command normally
      command();
      return;
    }

    // Check if turning on AC would exceed quota
    if (operation === 'power_on' && estimatedUsage > 0) {
      const wouldExceed = wouldExceedQuota(userId, roomId, estimatedUsage);
      const atWarning = isQuotaAtWarningLevel(userId, roomId);
      
      if (wouldExceed && !hasActiveOverride(userId, roomId)) {
        // Show warning modal and prevent command
        setPendingCommand(() => command);
        setShowWarningModal(true);
        return;
      }
      
      if (atWarning) {
        // Show warning but allow command
        setPendingCommand(() => command);
        setShowWarningModal(true);
        return;
      }
    }

    // Check for active blocking violations
    if (isBlocked) {
      setPendingCommand(() => command);
      setShowWarningModal(true);
      return;
    }

    // All checks passed, send command
    command();
  }, [balance, estimatedUsage, wouldExceedQuota, isQuotaAtWarningLevel, hasActiveOverride, isBlocked, userId, roomId]);

  // Handle modal actions
  const handleModalClose = useCallback(() => {
    setShowWarningModal(false);
    setPendingCommand(null);
  }, []);

  // AC Control Functions
  const togglePower = useCallback(async () => {
    const newModeState = isPowerOn ? 'off' : 'cool'; // Default to cool mode when turning on
    const command = async () => await setModeCmd(roomId, newModeState);
    
    if (newModeState !== 'off') {
      sendQuotaAwareCommand(command, 'power_on');
    } else {
      await command();
    }
  }, [isPowerOn, setModeCmd, sendQuotaAwareCommand, roomId]);

  const setTemperature = useCallback(async (temp: number) => {
    const command = async () => await setTemperatureCmd(roomId, temp);
    if (isPowerOn) {
      sendQuotaAwareCommand(command, 'temperature_change');
    } else {
      await command();
    }
  }, [isPowerOn, setTemperatureCmd, sendQuotaAwareCommand, roomId]);

  const setMode = useCallback(async (mode: 'off' | 'heat_cool' | 'cool' | 'dry' | 'heat' | 'fan_only') => {
    const command = async () => await setModeCmd(roomId, mode);
    if (isPowerOn && mode !== 'off') {
      sendQuotaAwareCommand(command, 'mode_change');
    } else {
      await command();
    }
  }, [isPowerOn, setModeCmd, sendQuotaAwareCommand, roomId]);

  const setFanSpeed = useCallback(async (fan: 'AUTO' | '1' | '2' | '3' | '4' | 'QUIET' | 'auto' | 'low' | 'middle' | 'medium' | 'high' | 'diffuse') => {
    const command = async () => await setFanCmd(roomId, fan);
    if (isPowerOn) {
      sendQuotaAwareCommand(command, 'fan_change');
    } else {
      await command();
    }
  }, [isPowerOn, setFanCmd, sendQuotaAwareCommand, roomId]);

  if (!roomState) {
    return (
      <Card className={cn("w-full max-w-md mx-auto", className)}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Loading room data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const temperature = currentSettings?.temperature || 20;
  const mode = currentSettings?.mode || 'off';
  const fanSpeed = currentSettings?.fan || 'auto';

  return (
    <div className={cn("space-y-4", className)}>
      {/* Quota Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">AC Control</h2>
          {balance && (
            <QuotaStatusBadge 
              userId={userId} 
              roomId={roomId}
              showTooltip={true}
            />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isConnected && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              AC Offline
            </Badge>
          )}
          
          {balance && !quotaConnected && (
            <Badge variant="outline" className="text-xs">
              Quota Offline
            </Badge>
          )}
        </div>
      </div>

      {/* Main AC Remote Control */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Room Controls</span>
              {isBlocked && (
                <Badge variant="destructive" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Blocked
                </Badge>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              Status: {roomState.online ? 'Online' : 'Offline'}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Power Control */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Power className="h-5 w-5" />
              <span className="font-medium">Power</span>
            </div>
            <Switch
              checked={isPowerOn}
              onCheckedChange={togglePower}
              disabled={!isConnected || (isBlocked && !isPowerOn)}
            />
          </div>

          <Separator />

          {/* Temperature Control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Thermometer className="h-5 w-5" />
                <span className="font-medium">Temperature</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTemperature(Math.max(16, temperature - 1))}
                  disabled={!isPowerOn || !isConnected || isBlocked}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <span className="text-2xl font-bold min-w-[3rem] text-center">
                  {temperature}°
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTemperature(Math.min(30, temperature + 1))}
                  disabled={!isPowerOn || !isConnected || isBlocked}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Slider
              value={[temperature]}
              onValueChange={([value]) => setTemperature(value)}
              min={16}
              max={30}
              step={1}
              disabled={!isPowerOn || !isConnected || isBlocked}
              className="w-full"
            />
          </div>

          <Separator />

          {/* Mode Control */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wind className="h-5 w-5" />
              <span className="font-medium">Mode</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'heat', mode: 'heat' as const }, 
                { key: 'cool', mode: 'cool' as const }, 
                { key: 'dry', mode: 'dry' as const }, 
                { key: 'fan', mode: 'fan_only' as const }
              ].map(({ key, mode: modeValue }) => (
                <Button
                  key={key}
                  variant={mode === modeValue ? "default" : "outline"}
                  onClick={() => setMode(modeValue)}
                  disabled={!isPowerOn || !isConnected || isBlocked}
                  className="capitalize"
                >
                  {key}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Fan Speed Control */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wind className="h-5 w-5" />
              <span className="font-medium">Fan Speed</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'auto', speed: 'auto' as const },
                { key: 'low', speed: 'low' as const },
                { key: 'medium', speed: 'medium' as const },
                { key: 'high', speed: 'high' as const }
              ].map(({ key, speed: speedValue }) => (
                <Button
                  key={key}
                  variant={fanSpeed === speedValue ? "default" : "outline"}
                  onClick={() => setFanSpeed(speedValue)}
                  disabled={!isPowerOn || !isConnected || isBlocked}
                  size="sm"
                  className="capitalize text-xs"
                >
                  {key}
                </Button>
              ))}
            </div>
          </div>

          {/* Quota Prediction */}
          {balance && isPowerOn && estimatedUsage > 0 && (
            <div className="pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Estimated usage: {Math.floor(estimatedUsage / 60)} minutes
                  {balance.remainingSeconds && (
                    <span className="ml-2">
                      • {Math.floor((balance.remainingSeconds - estimatedUsage) / 60)} min remaining
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Quota Information */}
      {showQuotaDetails && balance && (
        <QuotaUsageCard
          userId={userId}
          roomId={roomId}
          showTrends={false}
          compact={false}
        />
      )}

      {/* Quota Warning Modal */}
      <QuotaWarningModal
        userId={userId}
        roomId={roomId}
        open={showWarningModal}
        onClose={handleModalClose}
        allowOverrideRequest={allowOverrideRequests}
      />
    </div>
  );
});

QuotaAwareAirConRemote.displayName = 'QuotaAwareAirConRemote';

export default QuotaAwareAirConRemote;