/**
 * Device utility functions
 *
 * Provides helper functions for device type labels, colors, and icons.
 */

import { DeviceType } from '@/types/device';

/**
 * Get human-readable label for device type.
 *
 * @param type - Device type enum value
 * @returns Human-readable device type label
 *
 * @example
 * getDeviceTypeLabel(DeviceType.AIR_CONDITIONER) // "Air Conditioner"
 */
export function getDeviceTypeLabel(type: DeviceType): string {
  const labels: Record<DeviceType, string> = {
    [DeviceType.AIR_CONDITIONER]: 'Air Conditioner',
    [DeviceType.THERMOSTAT]: 'Thermostat',
    [DeviceType.HUMIDIFIER]: 'Humidifier',
    [DeviceType.FAN]: 'Fan',
  };

  return labels[type] || 'Unknown Device';
}

/**
 * Get Tailwind CSS color class for device type badge.
 * Returns semantic colors that work in both light and dark modes.
 *
 * @param type - Device type enum value
 * @returns Tailwind CSS color class string
 *
 * @example
 * getDeviceTypeColor(DeviceType.AIR_CONDITIONER) // "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
 */
export function getDeviceTypeColor(type: DeviceType): string {
  const colors: Record<DeviceType, string> = {
    [DeviceType.AIR_CONDITIONER]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    [DeviceType.THERMOSTAT]: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    [DeviceType.HUMIDIFIER]: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
    [DeviceType.FAN]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  };

  return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
}

/**
 * Get status badge color class based on enabled status.
 *
 * @param enabled - Whether device is enabled
 * @returns Tailwind CSS color class string
 *
 * @example
 * getStatusColor(true) // "text-green-600 dark:text-green-400"
 * getStatusColor(false) // "text-gray-600 dark:text-gray-400"
 */
export function getStatusColor(enabled: boolean): string {
  return enabled
    ? 'text-green-600 dark:text-green-400'
    : 'text-gray-600 dark:text-gray-400';
}

/**
 * Get status badge variant based on enabled status.
 *
 * @param enabled - Whether device is enabled
 * @returns Badge variant ("default" or "secondary")
 *
 * @example
 * getStatusVariant(true) // "default"
 * getStatusVariant(false) // "secondary"
 */
export function getStatusVariant(enabled: boolean): 'default' | 'secondary' {
  return enabled ? 'default' : 'secondary';
}

/**
 * Format device identifier for display.
 * Converts lowercase hyphenated identifiers to title case with spaces.
 *
 * @param identifier - Device identifier (e.g., "living-room-ac-01")
 * @returns Formatted identifier (e.g., "Living Room Ac 01")
 *
 * @example
 * formatDeviceIdentifier("living-room-ac-01") // "Living Room Ac 01"
 */
export function formatDeviceIdentifier(identifier: string): string {
  return identifier
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate device display name from available metadata.
 * Falls back to formatted identifier if no metadata is available.
 *
 * @param device - Device object with identifier, manufacturer, and model
 * @returns Display name string
 *
 * @example
 * generateDeviceDisplayName({ deviceIdentifier: "bedroom-ac", manufacturer: "Mitsubishi", model: "MSZ-FH" })
 * // "Mitsubishi MSZ-FH"
 *
 * generateDeviceDisplayName({ deviceIdentifier: "bedroom-ac" })
 * // "Bedroom Ac"
 */
export function generateDeviceDisplayName(device: {
  deviceIdentifier: string;
  manufacturer?: string;
  model?: string;
}): string {
  if (device.manufacturer && device.model) {
    return `${device.manufacturer} ${device.model}`;
  }
  if (device.manufacturer) {
    return device.manufacturer;
  }
  if (device.model) {
    return device.model;
  }
  return formatDeviceIdentifier(device.deviceIdentifier);
}
