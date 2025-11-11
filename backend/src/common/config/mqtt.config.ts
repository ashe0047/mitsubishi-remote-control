import { registerAs } from '@nestjs/config';

export default registerAs('mqtt', () => ({
  brokerUrl:
    process.env.MQTT_BROKER_URL ||
    `mqtt://${process.env.MQTT_BROKER_HOST || process.env.MQTT_BROKER || '10.0.16.3'}:${process.env.MQTT_BROKER_PORT || '1883'}`,
  broker:
    process.env.MQTT_BROKER ||
    `mqtt://${process.env.MQTT_BROKER_HOST || '10.0.16.3'}:${process.env.MQTT_BROKER_PORT || '1883'}`,
  username:
    process.env.MQTT_BROKER_USERNAME ||
    process.env.MQTT_USERNAME ||
    'mqtt-service',
  password:
    process.env.MQTT_BROKER_PASSWORD ||
    process.env.MQTT_PASSWORD ||
    'asus1122334455',
  clientId: process.env.MQTT_CLIENT_ID || `turing-server-${Date.now()}`,

  // MQTT connection settings
  keepAliveInterval: parseInt(process.env.MQTT_KEEP_ALIVE || '30', 10),
  connectionTimeout: parseInt(process.env.MQTT_CONNECTION_TIMEOUT || '60', 10),
  cleanSession: process.env.MQTT_CLEAN_SESSION === 'true',
  reconnectAttempts: parseInt(process.env.MQTT_RECONNECT_ATTEMPTS || '10', 10),
  reconnectDelay: parseInt(process.env.MQTT_RECONNECT_DELAY || '3000', 10),
  baseTopic: process.env.MQTT_BASE_TOPIC || 'mitsubishi2mqtt',
}));
