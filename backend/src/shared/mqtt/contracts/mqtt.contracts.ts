export interface MqttMessage {
  topic: string;
  payload: unknown;
  timestamp?: number;
  qos?: 0 | 1 | 2;
}
