import z from 'zod';
import {
  batchCommandDataSchema,
  batchStatusDataSchema,
  configGetDataSchema,
  configResetDataSchema,
  configUpdateDataSchema,
  connectDataSchema,
  deviceCommandSchema,
  disconnectDataSchema,
  genericDeviceValidationSchema,
  getCapabilitiesDataSchema,
  getInfoDataSchema,
  healthCheckDataSchema,
  monitoringGetDataSchema,
  monitoringStartDataSchema,
  monitoringStopDataSchema,
  pingDataSchema,
  restartDataSchema,
  subscribeEventsDataSchema,
  unsubscribeEventsDataSchema,
} from '../schemas/generic-device.schema';

/**
 * Device-specific command message
 */
export type DeviceMessage = z.infer<typeof deviceCommandSchema>;

// Export type helpers
export type GenericDeviceCommandData = z.infer<
  typeof genericDeviceValidationSchema
>;
export type ConnectData = z.infer<typeof connectDataSchema>;
export type DisconnectData = z.infer<typeof disconnectDataSchema>;
export type RestartData = z.infer<typeof restartDataSchema>;
export type GetInfoData = z.infer<typeof getInfoDataSchema>;
export type GetCapabilitiesData = z.infer<typeof getCapabilitiesDataSchema>;
export type PingData = z.infer<typeof pingDataSchema>;
export type HealthCheckData = z.infer<typeof healthCheckDataSchema>;
export type SubscribeEventsData = z.infer<typeof subscribeEventsDataSchema>;
export type UnsubscribeEventsData = z.infer<typeof unsubscribeEventsDataSchema>;
export type BatchCommandData = z.infer<typeof batchCommandDataSchema>;
export type BatchStatusData = z.infer<typeof batchStatusDataSchema>;
export type ConfigUpdateData = z.infer<typeof configUpdateDataSchema>;
export type ConfigGetData = z.infer<typeof configGetDataSchema>;
export type ConfigResetData = z.infer<typeof configResetDataSchema>;
export type MonitoringStartData = z.infer<typeof monitoringStartDataSchema>;
export type MonitoringStopData = z.infer<typeof monitoringStopDataSchema>;
export type MonitoringGetData = z.infer<typeof monitoringGetDataSchema>;
