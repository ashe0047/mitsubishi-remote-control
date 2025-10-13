import {
  Sun,
  Snowflake,
  Droplets,
  Fan,
  Wind,
  Power,
} from 'lucide-react';
import { MODE_VALUES, type VALID_VALUES } from '@/lib/mqtt/mqtt-config';

/**
 * Get the icon component for a given AC mode
 * @param mode - AC mode value
 * @returns React icon component
 */
export const getModeIcon = (mode: (typeof VALID_VALUES.mode)[number]) => {
  switch (mode) {
    case MODE_VALUES.HEAT:
      return <Sun className="h-5 w-5" />;
    case MODE_VALUES.COOL:
      return <Snowflake className="h-5 w-5" />;
    case MODE_VALUES.DRY:
      return <Droplets className="h-5 w-5" />;
    case MODE_VALUES.FAN_ONLY:
      return <Fan className="h-5 w-5" />;
    case MODE_VALUES.HEAT_COOL:
      return <Wind className="h-5 w-5" />;
    default:
      return <Power className="h-5 w-5" />;
  }
};

/**
 * Get the fan icon component
 * @returns Fan icon component
 */
export const getFanIcon = () => {
  return <Fan className="h-5 w-5" />;
};
