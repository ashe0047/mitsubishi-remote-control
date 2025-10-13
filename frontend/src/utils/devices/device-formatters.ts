import { FAN_VALUES, MODE_VALUES, type VALID_VALUES } from '@/lib/mqtt/mqtt-config';

/**
 * Get the display name for a fan speed value
 * @param fan - Fan speed value
 * @returns Human-readable fan speed name
 */
export const getFanDisplayName = (fan: string): string => {
  switch (fan) {
    case FAN_VALUES.AUTO:
      return 'Auto';
    case FAN_VALUES.ONE:
      return 'Low';
    case FAN_VALUES.TWO:
      return 'Middle';
    case FAN_VALUES.THREE:
      return 'Medium';
    case FAN_VALUES.FOUR:
      return 'High';
    case FAN_VALUES.QUIET:
      return 'Quiet';
    default:
      return fan;
  }
};

/**
 * Get the display name for an AC mode value
 * @param mode - AC mode value
 * @returns Human-readable mode name
 */
export const getModeDisplayName = (mode: (typeof VALID_VALUES.mode)[number]): string => {
  switch (mode) {
    case MODE_VALUES.HEAT:
      return 'Heat';
    case MODE_VALUES.COOL:
      return 'Cool';
    case MODE_VALUES.DRY:
      return 'Dry';
    case MODE_VALUES.FAN_ONLY:
      return 'Fan';
    case MODE_VALUES.HEAT_COOL:
      return 'Auto';
    case MODE_VALUES.OFF:
      return 'Off';
    default:
      return mode;
  }
};
