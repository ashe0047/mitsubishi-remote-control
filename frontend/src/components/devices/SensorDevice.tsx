"use client";

import React from 'react';
import { BaseDevice, DeviceState } from './BaseDevice';
import { Badge } from '@/components/ui/badge';
import { Thermometer, Droplets, Wind, Eye, Gauge } from 'lucide-react';

export interface SensorState extends DeviceState {
  type: 'sensor';
  temperature?: number;
  humidity?: number;
  airQuality?: number;
  motion?: boolean;
  pressure?: number;
  readings: {
    temperature?: number;
    humidity?: number;
    airQuality?: number;
    motion?: boolean;
    pressure?: number;
  };
}

export interface SensorDeviceProps {
  device: SensorState;
  onPowerToggle: (deviceId: string, power: boolean) => Promise<void>;
  onSettings?: (deviceId: string) => void;
  className?: string;
}

const SensorDevice: React.FC<SensorDeviceProps> = ({
  device,
  onPowerToggle,
  onSettings,
  className,
}) => {
  const getAirQualityStatus = (aqi: number) => {
    if (aqi <= 50) return { label: 'Good', color: 'bg-green-500/10 text-green-500 border-green-500/20' };
    if (aqi <= 100) return { label: 'Moderate', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' };
    if (aqi <= 200) return { label: 'Unhealthy', color: 'bg-red-500/10 text-red-500 border-red-500/20' };
    return { label: 'Very Unhealthy', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
  };

  const readings = device.readings;

  return (
    <BaseDevice
      device={device}
      onPowerToggle={onPowerToggle}
      onSettings={onSettings}
      className={className}
    >
      {device.power && device.online && (
        <div className="space-y-3">
          {/* Temperature */}
          {readings.temperature !== undefined && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Thermometer className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Temperature</span>
              </div>
              <Badge variant="outline">
                {readings.temperature}°C
              </Badge>
            </div>
          )}

          {/* Humidity */}
          {readings.humidity !== undefined && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Droplets className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium">Humidity</span>
              </div>
              <Badge variant="outline">
                {readings.humidity}%
              </Badge>
            </div>
          )}

          {/* Air Quality */}
          {readings.airQuality !== undefined && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wind className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Air Quality</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {readings.airQuality} AQI
                </Badge>
                <Badge
                  variant="outline"
                  className={getAirQualityStatus(readings.airQuality).color}
                >
                  {getAirQualityStatus(readings.airQuality).label}
                </Badge>
              </div>
            </div>
          )}

          {/* Motion Detection */}
          {readings.motion !== undefined && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Motion</span>
              </div>
              <Badge
                variant="outline"
                className={
                  readings.motion
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                }
              >
                {readings.motion ? 'Detected' : 'Clear'}
              </Badge>
            </div>
          )}

          {/* Pressure */}
          {readings.pressure !== undefined && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Gauge className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Pressure</span>
              </div>
              <Badge variant="outline">
                {readings.pressure} hPa
              </Badge>
            </div>
          )}

          {/* Last Update */}
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground text-center">
              Last updated: {new Date(device.lastUpdate).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {device.power && !device.online && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Sensor offline - No data available
          </p>
        </div>
      )}
    </BaseDevice>
  );
};

export default SensorDevice;