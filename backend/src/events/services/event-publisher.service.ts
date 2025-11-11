import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MqttStateUpdateEvent,
  MqttSettingsUpdateEvent,
  MqttConnectionEvent,
  QuotaUpdateEvent,
  QuotaViolationEvent,
} from '../../devices/interfaces/mqtt-events.interface';

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publish MQTT state update event (matching Spring Boot @EventListener pattern)
   */
  publishMqttStateUpdate(roomId: string, state: any): void {
    const event: MqttStateUpdateEvent = {
      source: 'MQTT Service',
      roomId,
      state,
      timestamp: new Date(),
    };

    this.logger.debug(`Publishing MQTT state update event for room ${roomId}`);
    this.eventEmitter.emit('mqtt.state.update', event);
  }

  /**
   * Publish MQTT settings update event
   */
  publishMqttSettingsUpdate(roomId: string, settings: any): void {
    const event: MqttSettingsUpdateEvent = {
      source: 'MQTT Service',
      roomId,
      settings,
      timestamp: new Date(),
    };

    this.logger.debug(
      `Publishing MQTT settings update event for room ${roomId}`,
    );
    this.eventEmitter.emit('mqtt.settings.update', event);
  }

  /**
   * Publish MQTT connection event
   */
  publishMqttConnectionEvent(
    clientId: string,
    connected: boolean,
    reason?: string,
  ): void {
    const event: MqttConnectionEvent = {
      source: 'MQTT Service',
      clientId,
      connected,
      timestamp: new Date(),
      reason,
    };

    this.logger.debug(
      `Publishing MQTT connection event: ${clientId} ${connected ? 'connected' : 'disconnected'}`,
    );
    this.eventEmitter.emit('mqtt.connection', event);
  }

  /**
   * Publish quota update event
   */
  publishQuotaUpdate(
    quotaId: string,
    userId: string,
    userName: string,
    roomId: string,
    roomName: string,
    usage: {
      remainingSeconds?: number;
      remainingCount?: number;
      remainingEnergy?: number;
      remainingCost?: number;
    },
  ): void {
    const event: QuotaUpdateEvent = {
      source: 'Quota Service',
      quotaId,
      userId,
      userName,
      roomId,
      roomName,
      usage,
      timestamp: new Date(),
    };

    this.logger.debug(
      `Publishing quota update event for user ${userId} in room ${roomId}`,
    );
    this.eventEmitter.emit('quota.update', event);
  }

  /**
   * Publish quota violation event
   */
  publishQuotaViolation(
    quotaId: string,
    userId: string,
    userName: string,
    roomId: string,
    roomName: string,
    violationType: 'TIME_QUOTA' | 'COUNT_QUOTA' | 'ENERGY_QUOTA' | 'COST_QUOTA',
    usagePercent: number,
    limitPercent: number,
  ): void {
    const event: QuotaViolationEvent = {
      source: 'Quota Service',
      quotaId,
      userId,
      userName,
      roomId,
      roomName,
      violationType,
      usagePercent,
      limitPercent,
      timestamp: new Date(),
    };

    this.logger.warn(
      `Publishing quota violation event for user ${userId}: ${violationType} at ${usagePercent}%`,
    );
    this.eventEmitter.emit('quota.violation', event);
  }
}
