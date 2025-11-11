import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Observable,
  BehaviorSubject,
  interval,
  Subject,
  combineLatest,
  of,
  from,
  EMPTY,
} from 'rxjs';
import {
  map,
  distinctUntilChanged,
  switchMap,
  catchError,
  share,
  shareReplay,
  tap,
  startWith,
} from 'rxjs/operators';
import { AirConState } from '../interfaces/aircon-state.interface';
import { AirConSettings } from '../interfaces/aircon-settings.interface';
import { RoomInfo } from '../interfaces/room-info.interface';
import { RoomStateUpdate } from '../interfaces/room-state-update.interface';
import { MqttStateUpdateEvent } from '../interfaces/mqtt-events.interface';
import { EventPublisherService } from '../../events/services/event-publisher.service';

// TTL constants matching Spring Boot exactly
const ONLINE_DEVICE_CACHE_TTL = 30; // 30 seconds for online devices
const OFFLINE_DEVICE_CACHE_TTL = 120; // 2 minutes for offline devices
const STATE_UPDATE_INTERVAL = 2000; // 2 seconds matching Spring Boot
const OFFLINE_THRESHOLD_MINUTES = 5; // 5 minutes matching Spring Boot

// Cache entry interfaces matching Spring Boot records
interface CachedDeviceState {
  state: AirConState;
  timestamp: number;
  ttl: number;
}

// Note: removed unused cached settings/info interfaces to satisfy linting

@Injectable()
export class DeviceStateManagerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DeviceStateManagerService.name);

  // In-memory state storage (matching Spring Boot ConcurrentHashMap pattern)
  private readonly roomStates = new Map<string, AirConState>();
  private readonly roomSettings = new Map<string, AirConSettings>();
  private readonly lastUpdated = new Map<string, Date>();
  private readonly roomNames = new Map<string, string>();

  // RxJS streams for reactive state management (matching Spring Boot reactive patterns)
  private readonly stateUpdates$ = new Subject<MqttStateUpdateEvent>();
  private readonly roomStateStreams = new Map<
    string,
    BehaviorSubject<AirConState | null>
  >();
  private readonly roomOnlineStatus = new Map<
    string,
    BehaviorSubject<boolean>
  >();

  // Cache statistics (matching Spring Boot AtomicLong pattern)
  private cacheHits = 0;
  private cacheMisses = 0;

  // Background cleanup intervals
  private cleanupInterval: NodeJS.Timeout;
  private readonly redis: Redis;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly eventPublisher: EventPublisherService,
  ) {
    // Initialize Redis client (would use proper injection in production)
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 3,
    });

    // Setup Redis error handling
    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing DeviceStateManagerService');

    // Setup event listeners (matching Spring Boot @EventListener pattern)
    this.setupEventListeners();

    // Start background cleanup (matching Spring Boot Flux.interval pattern)
    this.startBackgroundCleanup();

    // Subscribe to state updates (matching Spring Boot reactive subscription)
    this.subscribeToStateUpdates();

    // Initialize any existing rooms from Redis
    await this.initializeFromCache();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Cleaning up DeviceStateManagerService');

    // Cleanup intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Complete all subjects
    this.stateUpdates$.complete();
    this.roomStateStreams.forEach((stream) => stream.complete());
    this.roomOnlineStatus.forEach((stream) => stream.complete());

    // Disconnect Redis
    if (this.redis) {
      await this.redis.quit();
    }
  }

  /**
   * Handle state update from MQTT (matching Spring Boot handleStateUpdate pattern)
   */
  async handleStateUpdate(event: MqttStateUpdateEvent): Promise<void> {
    const roomId = event.roomId;
    const state = event.state;

    this.logger.debug(
      `Received state update for room ${roomId}: ${JSON.stringify(state)}`,
    );

    try {
      // Update in-memory state (matching Spring Boot ConcurrentHashMap operations)
      this.roomStates.set(roomId, state);
      this.lastUpdated.set(roomId, new Date());

      // Dynamic room discovery (matching Spring Boot pattern)
      if (!this.roomNames.has(roomId)) {
        this.roomNames.set(roomId, roomId);
        this.logger.log(`Discovered new room: ${roomId}`);
      }

      // Cache in Redis with TTL
      await this.cacheDeviceState(roomId, state);

      // Update reactive streams
      this.updateReactiveStreams(roomId, state);

      // Publish to state updates subject
      this.stateUpdates$.next(event);
    } catch (error) {
      this.logger.error(
        `Failed to handle state update for room ${roomId}`,
        error,
      );
    }
  }

  /**
   * Get current state for a specific room (matching Spring Boot getRoomState pattern)
   */
  getRoomState(roomId: string): Observable<AirConState | null> {
    // First try in-memory cache (matching Spring Boot immediate access pattern)
    const memoryState = this.roomStates.get(roomId);
    if (memoryState) {
      this.cacheHits++;
      return of(memoryState);
    }

    // Try Redis cache
    this.cacheMisses++;
    return from(this.getCachedDeviceState(roomId)).pipe(
      map((cached) => (cached ? cached.state : null)),
      tap((state) => {
        if (state) {
          // Restore to in-memory cache
          this.roomStates.set(roomId, state);
          this.lastUpdated.set(roomId, new Date());
        }
      }),
    );
  }

  /**
   * Get reactive state stream for a room (matching Spring Boot getStateStream pattern)
   */
  getStateStream(roomId: string): Observable<AirConState | null> {
    // Create stream if not exists (matching Spring Boot per-room stream pattern)
    if (!this.roomStateStreams.has(roomId)) {
      const initialState = this.roomStates.get(roomId) || null;
      this.roomStateStreams.set(
        roomId,
        new BehaviorSubject<AirConState | null>(initialState),
      );
    }

    const stateStream = this.roomStateStreams.get(roomId)!;

    // Return periodic polling stream (matching Spring Boot Flux.interval pattern)
    return interval(STATE_UPDATE_INTERVAL).pipe(
      map(() => this.roomStates.get(roomId) || null),
      distinctUntilChanged(),
      startWith(stateStream.value),
      share(),
    );
  }

  /**
   * Get all rooms with their states (matching Spring Boot getRooms pattern)
   */
  getRooms(): Observable<RoomInfo[]> {
    return of(Array.from(this.roomNames.keys())).pipe(
      switchMap((roomIds) => {
        const roomInfos$ = roomIds.map((roomId) =>
          of(this.buildRoomInfo(roomId)),
        );
        return combineLatest(roomInfos$);
      }),
      map((rooms) => rooms.filter((room): room is RoomInfo => room !== null)),
      shareReplay(1),
    );
  }

  /**
   * Get all state updates (matching Spring Boot getAllStateUpdates pattern)
   */
  getAllStateUpdates(): Observable<RoomStateUpdate> {
    return this.stateUpdates$.pipe(
      map((event) => ({
        roomId: event.roomId,
        state: event.state,
        timestamp: new Date(),
      })),
      share(),
    );
  }

  /**
   * Check if room is online (matching Spring Boot isRoomOnline pattern)
   */
  isRoomOnline(roomId: string): boolean {
    const lastUpdate = this.lastUpdated.get(roomId);
    if (!lastUpdate) {
      return false;
    }

    // Consider room online if updated within last 5 minutes (matching Spring Boot logic)
    const fiveMinutesAgo = new Date(
      Date.now() - OFFLINE_THRESHOLD_MINUTES * 60 * 1000,
    );
    return lastUpdate > fiveMinutesAgo;
  }

  /**
   * Get online status stream for a room
   */
  getRoomOnlineStatus(roomId: string): Observable<boolean> {
    if (!this.roomOnlineStatus.has(roomId)) {
      const initialStatus = this.isRoomOnline(roomId);
      this.roomOnlineStatus.set(
        roomId,
        new BehaviorSubject<boolean>(initialStatus),
      );
    }

    const statusStream = this.roomOnlineStatus.get(roomId)!;

    // Periodic status check
    return interval(STATE_UPDATE_INTERVAL).pipe(
      map(() => this.isRoomOnline(roomId)),
      distinctUntilChanged(),
      startWith(statusStream.value),
      share(),
    );
  }

  /**
   * Get cache statistics (matching Spring Boot cache monitoring)
   */
  getCacheStatistics(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  // Private methods

  private async cacheDeviceState(
    roomId: string,
    state: AirConState,
  ): Promise<void> {
    try {
      const cacheKey = `device:state:${roomId}`;
      const isOnline = this.isRoomOnline(roomId);
      const ttl = isOnline ? ONLINE_DEVICE_CACHE_TTL : OFFLINE_DEVICE_CACHE_TTL;

      const cacheEntry: CachedDeviceState = {
        state,
        timestamp: Date.now(),
        ttl,
      };

      await this.redis.setex(cacheKey, ttl, JSON.stringify(cacheEntry));
    } catch (error) {
      this.logger.warn(
        `Failed to cache device state for room ${roomId}`,
        error,
      );
    }
  }

  private async getCachedDeviceState(
    roomId: string,
  ): Promise<CachedDeviceState | null> {
    try {
      const cacheKey = `device:state:${roomId}`;
      const cached = await this.redis.get(cacheKey);

      if (!cached) {
        return null;
      }

      const raw: unknown = JSON.parse(cached);
      const cacheEntry = raw as CachedDeviceState;

      // Check if cache entry is expired
      const age = Date.now() - cacheEntry.timestamp;
      if (age > cacheEntry.ttl * 1000) {
        await this.redis.del(cacheKey);
        return null;
      }

      return cacheEntry;
    } catch (error) {
      this.logger.warn(
        `Failed to get cached device state for room ${roomId}`,
        error,
      );
      return null;
    }
  }

  private async initializeFromCache(): Promise<void> {
    try {
      const pattern = 'device:state:*';
      const keys = await this.redis.keys(pattern);

      this.logger.log(`Initializing ${keys.length} rooms from cache`);

      for (const key of keys) {
        const roomId = key.replace('device:state:', '');
        const cached = await this.getCachedDeviceState(roomId);

        if (cached) {
          this.roomStates.set(roomId, cached.state);
          this.lastUpdated.set(roomId, new Date(cached.timestamp));
          this.roomNames.set(roomId, roomId);
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize from cache', error);
    }
  }

  private updateReactiveStreams(roomId: string, state: AirConState): void {
    // Update state stream
    if (!this.roomStateStreams.has(roomId)) {
      this.roomStateStreams.set(
        roomId,
        new BehaviorSubject<AirConState | null>(state),
      );
    } else {
      this.roomStateStreams.get(roomId)!.next(state);
    }

    // Update online status stream
    const isOnline = this.isRoomOnline(roomId);
    if (!this.roomOnlineStatus.has(roomId)) {
      this.roomOnlineStatus.set(roomId, new BehaviorSubject<boolean>(isOnline));
    } else {
      this.roomOnlineStatus.get(roomId)!.next(isOnline);
    }
  }

  private buildRoomInfo(roomId: string): RoomInfo | null {
    try {
      const state = this.roomStates.get(roomId);
      const isOnline = this.isRoomOnline(roomId);
      const lastUpdated = this.lastUpdated.get(roomId);

      if (!state || !lastUpdated) {
        return null;
      }

      return {
        roomId,
        roomName: this.roomNames.get(roomId) || roomId,
        state,
        isOnline,
        lastUpdated,
      };
    } catch (error) {
      this.logger.error(`Failed to build room info for ${roomId}`, error);
      return null;
    }
  }

  /**
   * Setup event listeners (matching Spring Boot @EventListener pattern)
   */
  private setupEventListeners(): void {
    // Listen to MQTT state update events
    this.eventEmitter.on('mqtt.state.update', (event: MqttStateUpdateEvent) => {
      void this.handleStateUpdate(event);
    });
  }

  // NOTE: Duplicate private handleStateUpdate removed; using the public async handleStateUpdate instead

  private subscribeToStateUpdates(): void {
    // Subscribe to internal state updates for additional processing
    this.stateUpdates$
      .pipe(
        tap((event) => {
          this.logger.debug(`State update stream processed: ${event.roomId}`);
        }),
        catchError((error) => {
          this.logger.error('Error in state updates stream', error);
          return EMPTY;
        }),
      )
      .subscribe();
  }

  private startBackgroundCleanup(): void {
    // Cleanup expired cache entries every minute (matching Spring Boot pattern)
    this.cleanupInterval = setInterval(() => {
      void this.cleanupExpiredEntries();
    }, 60000);

    this.logger.log('Started background cleanup interval');
  }

  private cleanupExpiredEntries(): void {
    try {
      const fiveMinutesAgo = new Date(
        Date.now() - OFFLINE_THRESHOLD_MINUTES * 60 * 1000,
      );
      let cleanedCount = 0;

      // Clean up offline rooms
      for (const [roomId, lastUpdate] of this.lastUpdated.entries()) {
        if (lastUpdate < fiveMinutesAgo) {
          // Remove from in-memory maps
          this.roomStates.delete(roomId);
          this.roomSettings.delete(roomId);
          this.lastUpdated.delete(roomId);
          // Keep roomNames for potential re-discovery

          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(`Cleaned up ${cleanedCount} expired room entries`);
      }
    } catch (error) {
      this.logger.error('Error during background cleanup', error);
    }
  }
}
