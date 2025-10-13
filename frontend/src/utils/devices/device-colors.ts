import { MODE_VALUES, type VALID_VALUES } from '@/lib/mqtt/mqtt-config';

/**
 * Get the background color classes for a given AC mode
 * @param mode - AC mode value
 * @returns Tailwind CSS classes for background and text color
 */
export const getModeColor = (mode: (typeof VALID_VALUES.mode)[number]): string => {
  switch (mode) {
    case MODE_VALUES.HEAT:
      return 'bg-orange-500 text-white hover:bg-orange-600';
    case MODE_VALUES.COOL:
      return 'bg-blue-500 text-white hover:bg-blue-600';
    case MODE_VALUES.DRY:
      return 'bg-teal-500 text-white hover:bg-teal-600';
    case MODE_VALUES.FAN_ONLY:
      return 'bg-gray-500 text-white hover:bg-gray-600';
    case MODE_VALUES.HEAT_COOL:
      return 'bg-purple-500 text-white hover:bg-purple-600';
    default:
      return 'bg-primary text-primary-foreground';
  }
};

/**
 * Get the text color classes for a given AC mode
 * @param mode - AC mode value
 * @returns Tailwind CSS classes for text color (theme-aware)
 */
export const getModeTextColor = (mode: (typeof VALID_VALUES.mode)[number]): string => {
  switch (mode) {
    case MODE_VALUES.HEAT:
      return 'text-orange-600 dark:text-orange-400';
    case MODE_VALUES.COOL:
      return 'text-blue-600 dark:text-blue-400';
    case MODE_VALUES.DRY:
      return 'text-teal-600 dark:text-teal-400';
    case MODE_VALUES.FAN_ONLY:
      return 'text-gray-600 dark:text-gray-400';
    case MODE_VALUES.HEAT_COOL:
      return 'text-purple-600 dark:text-purple-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};
