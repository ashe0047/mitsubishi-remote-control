"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Search, X } from 'lucide-react';
import { debounce } from '@/lib/performance';
import { DeviceType } from '@/types/device';
import { getDeviceTypeLabel } from '@/lib/utils/device-utils';
import { cn } from '@/lib/utils';

/**
 * Device filter criteria
 */
export interface DeviceFilters {
  /** Search term for identifier, manufacturer, model */
  searchTerm: string;
  /** Filter by device type (empty string = all types) */
  deviceType: string;
  /** Include disabled devices in results */
  includeDisabled: boolean;
}

/**
 * Props for DeviceSearchFilter component
 */
export interface DeviceSearchFilterProps {
  /** Current filter values */
  filters: DeviceFilters;
  /** Callback when filters change */
  onFilterChange: (filters: DeviceFilters) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Device search and filter component with debounced search input.
 * Provides search field, device type filter, and status filter.
 *
 * @example
 * <DeviceSearchFilter
 *   filters={filters}
 *   onFilterChange={setFilters}
 * />
 */
export const DeviceSearchFilter: React.FC<DeviceSearchFilterProps> = React.memo(({
  filters,
  onFilterChange,
  className,
}) => {
  // Local state for immediate UI updates
  const [searchInput, setSearchInput] = useState(filters.searchTerm);

  // Create debounced search function
  const performSearch = useCallback((term: string) => {
    onFilterChange({ ...filters, searchTerm: term });
  }, [filters, onFilterChange]);

  // Debounced search handler (300ms delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce(performSearch as (...args: unknown[]) => unknown, 300) as (term: string) => void,
    [performSearch]
  );

  // Update search term with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // Update device type filter
  const handleDeviceTypeChange = (value: string) => {
    onFilterChange({ ...filters, deviceType: value });
  };

  // Toggle include disabled filter
  const handleIncludeDisabledChange = (checked: boolean) => {
    onFilterChange({ ...filters, includeDisabled: checked });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchInput('');
    onFilterChange({
      searchTerm: '',
      deviceType: '',
      includeDisabled: false,
    });
  };

  // Sync local search input with external filters
  useEffect(() => {
    setSearchInput(filters.searchTerm);
  }, [filters.searchTerm]);

  // Check if any filters are active
  const hasActiveFilters = filters.searchTerm || filters.deviceType || filters.includeDisabled;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search devices by identifier, manufacturer, or model..."
          value={searchInput}
          onChange={handleSearchChange}
          className="pl-10 pr-10"
          aria-label="Search devices"
        />
        {searchInput && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('');
              onFilterChange({ ...filters, searchTerm: '' });
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Device Type Filter */}
        <div className="w-full sm:w-auto sm:min-w-[200px]">
          <Select value={filters.deviceType || "all"} onValueChange={(value) => handleDeviceTypeChange(value === "all" ? "" : value)}>
            <SelectTrigger className="w-full" aria-label="Filter by device type">
              <SelectValue placeholder="All device types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All device types</SelectItem>
              {Object.values(DeviceType).map((type) => (
                <SelectItem key={type} value={type}>
                  {getDeviceTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Show Disabled Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show-disabled"
            checked={filters.includeDisabled}
            onCheckedChange={handleIncludeDisabledChange}
            aria-label="Show disabled devices"
          />
          <Label
            htmlFor="show-disabled"
            className="text-sm font-normal cursor-pointer select-none"
          >
            Show disabled devices
          </Label>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="ml-auto"
            aria-label="Clear all filters"
          >
            <X className="h-4 w-4 mr-2" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
});

DeviceSearchFilter.displayName = 'DeviceSearchFilter';

export default DeviceSearchFilter;
