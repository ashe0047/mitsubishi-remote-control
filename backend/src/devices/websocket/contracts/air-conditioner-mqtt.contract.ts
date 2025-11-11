import z from 'zod';
import {
  StateSchema,
  SettingsSchema,
} from '../schemas/air-conditioner-mqtt.schema';

export type AirConditionerStateContract = z.infer<typeof StateSchema>;

export type AirConditionerSettingsContract = z.infer<typeof SettingsSchema>;
