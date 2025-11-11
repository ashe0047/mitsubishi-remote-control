import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { Subject, Observable } from 'rxjs';
import { ErrorExtractor } from '../errors/utils/error-extractor.utility';

// Interface for MQTT messages (compatible with mqtt.js)
export interface MqttMessage {
  topic: string;
  payload: Buffer;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  cmd?: string;
  dup?: boolean;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;
  private logger = new Logger(MqttService.name);
  private messageSubject = new Subject<MqttMessage>();
  private connectionAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const broker = this.configService.get<string>(
      'mqtt.broker',
      'mqtt://localhost:1883',
    );
    const username = this.configService.get<string>('mqtt.username');
    const password = this.configService.get<string>('mqtt.password');
    const clientId = this.configService.get<string>(
      'mqtt.clientId',
      `nest_${Date.now()}`,
    );

    if (!broker) {
      throw new Error('MQTT broker URL is required');
    }

    return new Promise((resolve, reject) => {
      const options: mqtt.IClientOptions = {
        clientId,
        username,
        password,
        clean: true,
        connectTimeout: 30000,
        reconnectPeriod: 5000,
        keepalive: 60,
        reschedulePings: false,
        protocolVersion: 4, // MQTT 3.1.1 for compatibility
      };

      this.client = mqtt.connect(broker, options);

      // Connection success
      this.client.on('connect', () => {
        this.logger.log(`Connected to MQTT broker: ${broker}`);
        this.connectionAttempts = 0;
        resolve();
      });

      // Connection error with enhanced logging
      this.client.on('error', (error) => {
        this.logger.error(
          `MQTT connection error: ${ErrorExtractor.safeMessage(error)}`,
          ErrorExtractor.safeStack(error),
        );
        reject(error);
      });

      // Message handling
      this.client.on('message', (topic, payload) => {
        this.logger.debug(`Received message on topic: ${topic}`);
        this.messageSubject.next({
          topic,
          payload,
          qos: 0,
          retain: false,
          cmd: 'publish',
          dup: false,
        });
      });

      // Connection events for monitoring
      this.client.on('offline', () => {
        this.logger.warn('MQTT client offline - attempting reconnection');
      });

      this.client.on('reconnect', () => {
        this.connectionAttempts++;
        if (this.connectionAttempts <= this.maxReconnectAttempts) {
          this.logger.log(
            `MQTT client reconnecting (attempt ${this.connectionAttempts}/${this.maxReconnectAttempts})`,
          );
        } else {
          this.logger.error('Max reconnection attempts reached');
          this.client.end();
        }
      });

      this.client.on('close', () => {
        this.logger.log('MQTT connection closed');
      });

      // Handle protocol errors
      this.client.on('packetsend', (packet) => {
        this.logger.debug(`Packet sent: ${packet.cmd}`);
      });

      this.client.on('packetreceive', (packet) => {
        this.logger.debug(`Packet received: ${packet.cmd}`);
      });
    });
  }

  private async disconnect(): Promise<void> {
    if (this.client && this.client.connected) {
      return new Promise((resolve) => {
        this.client.end(true, {}, () => {
          this.logger.log('Gracefully disconnected from MQTT broker');
          resolve();
        });

        // Force close after timeout
        setTimeout(() => {
          if (this.client) {
            this.client.end();
            resolve();
          }
        }, 5000);
      });
    }
  }

  /**
   * Publish message with QoS support
   * Uses mqtt.js recommended pattern for reliable publishing
   */
  publish(
    topic: string,
    message: string | Buffer,
    options?: mqtt.IClientPublishOptions,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const publishOptions: mqtt.IClientPublishOptions = {
        qos: 1, // Default to QoS 1 for reliable delivery
        retain: false,
        ...options,
      };

      this.client.publish(topic, message, publishOptions, (error) => {
        if (error) {
          this.logger.error(
            `Failed to publish to ${topic}: ${ErrorExtractor.safeMessage(error)}`,
          );
          reject(error);
        } else {
          this.logger.debug(
            `Message published to ${topic} (QoS: ${publishOptions.qos})`,
          );
          resolve();
        }
      });
    });
  }

  /**
   * Subscribe to topic with QoS support
   * Implements mqtt.js subscription best practices
   */
  subscribe(
    topic: string,
    options?: mqtt.IClientSubscribeOptions,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const subscribeOptions: mqtt.IClientSubscribeOptions = {
        qos: 1, // Default to QoS 1
        ...options,
      };

      this.client.subscribe(topic, subscribeOptions, (error, granted) => {
        if (error) {
          this.logger.error(
            `Failed to subscribe to ${topic}: ${ErrorExtractor.safeMessage(error)}`,
          );
          reject(error);
        } else {
          const qos =
            granted && granted.length > 0
              ? granted[0]?.qos
              : subscribeOptions.qos;
          this.logger.log(`Subscribed to topic: ${topic} with QoS: ${qos}`);
          resolve();
        }
      });
    });
  }

  /**
   * Unsubscribe from topic
   */
  unsubscribe(topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.unsubscribe(topic, (error) => {
        if (error) {
          this.logger.error(
            `Failed to unsubscribe from ${topic}: ${ErrorExtractor.safeMessage(error)}`,
          );
          reject(error);
        } else {
          this.logger.log(`Unsubscribed from topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  /**
   * Get message stream for reactive programming
   */
  getMessageStream(): Observable<MqttMessage> {
    return this.messageSubject.asObservable();
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  /**
   * Get client ID for debugging
   */
  getClientId(): string | undefined {
    return this.client?.options?.clientId;
  }
}
