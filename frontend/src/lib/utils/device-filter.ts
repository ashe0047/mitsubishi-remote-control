/**
 * Device Filtering Utility
 *
 * Client-side filtering logic for device lists.
 * Pure functions with no side effects for optimal performance and testability.
 */

import type { Device } from '@/types/device';
import type { DeviceFilters } from '@/components/device/DeviceSearchFilter';

/**
 * Filter devices based on search term, device type, and enabled status.
 *
 * Search is case-insensitive and matches against:
 * - Device identifier
 * - Manufacturer
 * - Model
 *
 * @param devices - Array of devices to filter
 * @param filters - Filter criteria
 * @returns Filtered array of devices
 *
 * @example
 * const filtered = filterDevices(allDevices, {
 *   searchTerm: 'mitsubishi',
 *   deviceType: 'AIRCONDITIONER',
 *   includeDisabled: false,
 * });
 */
export function filterDevices(
  devices: Device[],
  filters: DeviceFilters
): Device[] {
  const { searchTerm, deviceType, includeDisabled } = filters;

  return devices.filter((device) => {
    // Filter by enabled status
    if (!includeDisabled && !device.enabled) {
      return false;
    }

    // Filter by device type
    if (deviceType && device.deviceType !== deviceType) {
      return false;
    }

    // Filter by search term
    if (searchTerm) {
      const normalizedSearchTerm = searchTerm.toLowerCase().trim();
      const searchableFields = [
        device.deviceIdentifier,
        device.manufacturer || '',
        device.model || '',
      ];

      const matchesSearch = searchableFields.some((field) =>
        field.toLowerCase().includes(normalizedSearchTerm)
      );

      if (!matchesSearch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get count of devices by filter criteria.
 * Useful for displaying filter result counts.
 *
 * @param devices - Array of devices to count
 * @param filters - Filter criteria
 * @returns Count of devices matching filters
 *
 * @example
 * const count = getFilteredDeviceCount(allDevices, filters);
 * console.log(`${count} devices found`);
 */
export function getFilteredDeviceCount(
  devices: Device[],
  filters: DeviceFilters
): number {
  return filterDevices(devices, filters).length;
}

/**
 * Check if any filters are active.
 * Useful for conditional rendering of "clear filters" button.
 *
 * @param filters - Filter criteria
 * @returns True if any filters are active
 *
 * @example
 * if (hasActiveFilters(filters)) {
 *   // Show "Clear filters" button
 * }
 */
export function hasActiveFilters(filters: DeviceFilters): boolean {
  return Boolean(
    filters.searchTerm ||
    filters.deviceType ||
    filters.includeDisabled
  );
}

/**
 * Get default filter values.
 * Useful for resetting filters to initial state.
 *
 * @returns Default DeviceFilters object
 *
 * @example
 * const defaultFilters = getDefaultFilters();
 * setFilters(defaultFilters);
 */
export function getDefaultFilters(): DeviceFilters {
  return {
    searchTerm: '',
    deviceType: '',
    includeDisabled: false,
  };
}
