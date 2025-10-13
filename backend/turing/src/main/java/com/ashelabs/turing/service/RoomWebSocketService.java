package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.room.RoomResponse;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.RoomStatusUpdateMessage;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.RoomStatusUpdatePayload;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.RoomUpdateType;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.BatchedRoomUpdateMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Service for publishing room-level WebSocket updates after device control operations.
 * 
 * This service integrates with the existing WebSocket infrastructure to provide
 * real-time updates when device control operations complete. It includes batching
 * and debouncing capabilities to optimize network traffic.
 * 
 * Key Features:
 * - Publishes room updates after successful device control operations
 * - Includes updated device state and session information
 * - Handles WebSocket publishing failures gracefully
 * - Implements batching and debouncing for efficient updates
 * - Prioritizes user-initiated changes over automatic updates
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RoomWebSocketService {

    private final Sinks.Many<RoomStatusUpdateMessage> roomStatusUpdateSink;
    private final Sinks.Many<BatchedRoomUpdateMessage> batchedRoomUpdateSink;
    
    // Debouncing mechanism - tracks pending updates per room
    private final Map<UUID, PendingRoomUpdate> pendingUpdates = new ConcurrentHashMap<>();
    
    // Batching mechanism - collects updates for batch processing
    private final Map<String, BatchCollector> batchCollectors = new ConcurrentHashMap<>();
    
    // Configuration for batching and debouncing
    private static final Duration DEBOUNCE_DURATION = Duration.ofMillis(100);
    private static final Duration BATCH_WINDOW = Duration.ofMillis(50);
    private static final int MAX_BATCH_SIZE = 10;
    
    /**
     * Publish room update after successful device control operation.
     * 
     * This method publishes updated room data including device state and session
     * information to all WebSocket clients subscribed to the room.
     * 
     * @param roomResponse Updated room data after device control operation
     * @param updateType Type of update (device control, status change, etc.)
     * @param priority Update priority (USER_INITIATED, AUTOMATIC, SYSTEM)
     * @return Mono that completes when update is published
     */
    public Mono<Void> publishRoomUpdate(RoomResponse roomResponse, RoomUpdateType updateType, UpdatePriority priority) {
        return Mono.fromRunnable(() -> {
            try {
                UUID roomId = roomResponse.getId();
                
                log.debug("Publishing room update for room {} with type {} and priority {}", 
                    roomId, updateType, priority);
                
                // Create room status update payload
                RoomStatusUpdatePayload payload = createRoomStatusPayload(roomResponse, updateType);
                
                // Handle debouncing for automatic updates
                if (priority == UpdatePriority.AUTOMATIC) {
                    handleDebouncedUpdate(roomId, payload, priority);
                } else {
                    // Immediate publish for user-initiated and system updates
                    publishImmediateUpdate(payload);
                }
                
            } catch (Exception e) {
                log.warn("Failed to publish room update for room {}: {}", 
                    roomResponse.getId(), e.getMessage());
                // Don't propagate error - WebSocket publishing failures should not affect main operation
            }
        })
        .then()
        .onErrorResume(error -> {
            log.warn("Error in room WebSocket update publishing: {}", error.getMessage());
            return Mono.empty(); // Graceful degradation
        });
    }
    
    /**
     * Publish room update with default priority (USER_INITIATED).
     * 
     * @param roomResponse Updated room data
     * @param updateType Type of update
     * @return Mono that completes when update is published
     */
    public Mono<Void> publishRoomUpdate(RoomResponse roomResponse, RoomUpdateType updateType) {
        return publishRoomUpdate(roomResponse, updateType, UpdatePriority.USER_INITIATED);
    }
    
    /**
     * Publish high-priority room update that bypasses debouncing and batching.
     * 
     * This method is used for critical updates that must be sent immediately,
     * such as emergency shutdowns or security-related events.
     * 
     * @param roomResponse Updated room data
     * @param updateType Type of update
     * @return Mono that completes when update is published
     */
    public Mono<Void> publishImmediateRoomUpdate(RoomResponse roomResponse, RoomUpdateType updateType) {
        return Mono.fromRunnable(() -> {
            try {
                log.debug("Publishing immediate room update for room {} with type {}", 
                    roomResponse.getId(), updateType);
                
                // Cancel any pending debounced update for this room
                UUID roomId = roomResponse.getId();
                PendingRoomUpdate cancelled = pendingUpdates.remove(roomId);
                if (cancelled != null) {
                    log.debug("Cancelled pending debounced update for room {} due to immediate update", roomId);
                }
                
                // Create and publish payload immediately
                RoomStatusUpdatePayload payload = createRoomStatusPayload(roomResponse, updateType);
                publishImmediateUpdate(payload);
                
            } catch (Exception e) {
                log.warn("Failed to publish immediate room update for room {}: {}", 
                    roomResponse.getId(), e.getMessage());
            }
        })
        .then()
        .onErrorResume(error -> {
            log.warn("Error in immediate room update publishing: {}", error.getMessage());
            return Mono.empty();
        });
    }
    
    /**
     * Publish room update after device control operation with device-specific context.
     * 
     * @param roomResponse Updated room data
     * @param deviceId Device that was controlled
     * @param action Device control action that was performed
     * @return Mono that completes when update is published
     */
    public Mono<Void> publishDeviceControlUpdate(RoomResponse roomResponse, String deviceId, String action) {
        return Mono.fromRunnable(() -> {
            try {
                log.debug("Publishing device control update for device {} in room {} after action {}", 
                    deviceId, roomResponse.getId(), action);
                
                // Create payload with device-specific information
                RoomStatusUpdatePayload payload = RoomStatusUpdatePayload.forDeviceUpdates(
                    roomResponse.getId().toString(),
                    roomResponse.getName(),
                    roomResponse.getAggregateStatus(),
                    roomResponse.getDevices(),
                    null,
                    null
                );
                
                // Device control updates are always user-initiated and high priority
                publishImmediateUpdate(payload);
                
            } catch (Exception e) {
                log.warn("Failed to publish device control update for device {} in room {}: {}", 
                    deviceId, roomResponse.getId(), e.getMessage());
            }
        })
        .then()
        .onErrorResume(error -> {
            log.warn("Error in device control WebSocket update: {}", error.getMessage());
            return Mono.empty();
        });
    }
    
    /**
     * Publish batched room updates for multiple rooms.
     * 
     * @param roomUpdates List of room status updates to batch
     * @return Mono that completes when batch is published
     */
    public Mono<Void> publishBatchedUpdates(List<RoomStatusUpdatePayload> roomUpdates) {
        return Mono.fromRunnable(() -> {
            try {
                if (roomUpdates.isEmpty()) {
                    return;
                }
                
                log.debug("Publishing batched room updates for {} rooms", roomUpdates.size());
                
                BatchedRoomUpdateMessage batchMessage = BatchedRoomUpdateMessage.create(roomUpdates);
                
                Sinks.EmitResult result = batchedRoomUpdateSink.tryEmitNext(batchMessage);
                if (result.isFailure()) {
                    log.warn("Failed to emit batched room update: {}", result);
                }
                
            } catch (Exception e) {
                log.warn("Failed to publish batched room updates: {}", e.getMessage());
            }
        })
        .then()
        .onErrorResume(error -> {
            log.warn("Error in batched room update publishing: {}", error.getMessage());
            return Mono.empty();
        });
    }
    
    /**
     * Create room status update payload from room response.
     */
    private RoomStatusUpdatePayload createRoomStatusPayload(RoomResponse roomResponse, RoomUpdateType updateType) {
        return new RoomStatusUpdatePayload(
            roomResponse.getId().toString(),
            roomResponse.getName(),
            roomResponse.getAggregateStatus(),
            roomResponse.getDevices(),
            Instant.now(),
            updateType,
            null,
            null
        );
    }
    
    /**
     * Handle debounced update for automatic updates to reduce noise.
     * 
     * This method implements intelligent debouncing that:
     * - Batches multiple device updates within a room
     * - Debounces rapid state changes to reduce update frequency
     * - Prioritizes user-initiated changes over automatic updates
     */
    private void handleDebouncedUpdate(UUID roomId, RoomStatusUpdatePayload payload, UpdatePriority priority) {
        pendingUpdates.compute(roomId, (id, existing) -> {
            if (existing == null) {
                // First update for this room - schedule debounced publish
                PendingRoomUpdate newUpdate = new PendingRoomUpdate(payload, priority);
                scheduleDebouncePublish(roomId, newUpdate);
                return newUpdate;
            } else {
                // Update existing pending update with latest data
                existing.updatePayload(payload, priority);
                
                // If priority was upgraded to user-initiated, publish immediately
                if (priority == UpdatePriority.USER_INITIATED && existing.getHighestPriority() == UpdatePriority.USER_INITIATED) {
                    // Cancel debounced update and publish immediately
                    PendingRoomUpdate toPublish = pendingUpdates.remove(roomId);
                    if (toPublish != null) {
                        publishImmediateUpdate(toPublish.getLatestPayload());
                        log.debug("Upgraded automatic update to immediate for room {} due to user action", roomId);
                        return null; // Remove from pending updates
                    }
                }
                
                return existing;
            }
        });
        
        log.debug("Debounced room update for room {} (pending updates: {})", 
            roomId, pendingUpdates.size());
    }
    
    /**
     * Batch multiple room updates within a time window for efficient WebSocket communication.
     * 
     * This method collects updates from multiple rooms and sends them as a single
     * batched message to reduce WebSocket overhead.
     * 
     * @param updates List of room updates to potentially batch
     * @param batchKey Key to identify the batch (e.g., "household_123")
     */
    public Mono<Void> publishBatchedRoomUpdates(List<RoomStatusUpdatePayload> updates, String batchKey) {
        return Mono.fromRunnable(() -> {
            try {
                if (updates.isEmpty()) {
                    return;
                }
                
                log.debug("Processing {} room updates for batching with key {}", updates.size(), batchKey);
                
                // Get or create batch collector for this key
                BatchCollector collector = batchCollectors.computeIfAbsent(batchKey, 
                    key -> new BatchCollector(key));
                
                // Add updates to collector
                collector.addUpdates(updates);
                
                // Check if we should flush the batch immediately
                if (collector.shouldFlush()) {
                    flushBatchCollector(batchKey, collector);
                } else if (!collector.isFlushScheduled()) {
                    // Schedule automatic flush if not already scheduled
                    scheduleBatchFlush(batchKey, collector);
                }
                
            } catch (Exception e) {
                log.warn("Failed to process batched room updates for key {}: {}", batchKey, e.getMessage());
            }
        })
        .then()
        .onErrorResume(error -> {
            log.warn("Error in batched room update processing: {}", error.getMessage());
            return Mono.empty();
        });
    }
    
    /**
     * Flush a batch collector and publish the batched updates.
     */
    private void flushBatchCollector(String batchKey, BatchCollector collector) {
        try {
            List<RoomStatusUpdatePayload> batchedUpdates = collector.getAndClearUpdates();
            if (!batchedUpdates.isEmpty()) {
                log.debug("Flushing batch {} with {} updates", batchKey, batchedUpdates.size());
                
                BatchedRoomUpdateMessage batchMessage = BatchedRoomUpdateMessage.create(batchedUpdates);
                
                Sinks.EmitResult result = batchedRoomUpdateSink.tryEmitNext(batchMessage);
                if (result.isFailure()) {
                    log.warn("Failed to emit batched room update for key {}: {}", batchKey, result);
                } else {
                    log.debug("Successfully published batched update for key {} with {} rooms", 
                        batchKey, batchedUpdates.size());
                }
            }
            
            // Remove collector if it's empty and old
            if (collector.isEmpty() && collector.isOld()) {
                batchCollectors.remove(batchKey);
            }
            
        } catch (Exception e) {
            log.warn("Failed to flush batch collector for key {}: {}", batchKey, e.getMessage());
        }
    }
    
    /**
     * Schedule debounced publish after delay.
     */
    private void scheduleDebouncePublish(UUID roomId, PendingRoomUpdate pendingUpdate) {
        Mono.delay(DEBOUNCE_DURATION)
            .subscribe(tick -> {
                PendingRoomUpdate toPublish = pendingUpdates.remove(roomId);
                if (toPublish != null && toPublish == pendingUpdate) {
                    publishImmediateUpdate(toPublish.getLatestPayload());
                    log.debug("Published debounced update for room {}", roomId);
                }
            });
    }
    
    /**
     * Schedule automatic batch flush for a collector.
     */
    private void scheduleBatchFlush(String batchKey, BatchCollector collector) {
        if (collector.isFlushScheduled()) {
            return; // Already scheduled
        }
        
        collector.setFlushScheduled(true);
        
        Mono.delay(BATCH_WINDOW)
            .subscribe(tick -> {
                BatchCollector currentCollector = batchCollectors.get(batchKey);
                if (currentCollector == collector && !collector.isEmpty()) {
                    flushBatchCollector(batchKey, collector);
                }
                collector.setFlushScheduled(false);
            });
    }
    
    /**
     * Cleanup old pending updates and batch collectors.
     * This method should be called periodically to prevent memory leaks.
     */
    public void cleanup() {
        try {
            
            // Clean up stale pending updates (older than 5 minutes)
            pendingUpdates.entrySet().removeIf(entry -> {
                boolean isStale = entry.getValue().isStale(Duration.ofMinutes(5));
                if (isStale) {
                    log.debug("Removing stale pending update for room {}", entry.getKey());
                }
                return isStale;
            });
            
            // Clean up old batch collectors
            batchCollectors.entrySet().removeIf(entry -> {
                BatchCollector collector = entry.getValue();
                if (collector.isOld()) {
                    // Flush any remaining updates before removing
                    if (!collector.isEmpty()) {
                        flushBatchCollector(entry.getKey(), collector);
                    }
                    log.debug("Removing old batch collector for key {}", entry.getKey());
                    return true;
                }
                return false;
            });
            
            log.debug("Cleanup completed - pending updates: {}, batch collectors: {}", 
                pendingUpdates.size(), batchCollectors.size());
                
        } catch (Exception e) {
            log.warn("Error during WebSocket service cleanup: {}", e.getMessage());
        }
    }
    
    /**
     * Publish update immediately without debouncing.
     */
    private void publishImmediateUpdate(RoomStatusUpdatePayload payload) {
        try {
            RoomStatusUpdateMessage message = RoomStatusUpdateMessage.create(payload);
            
            Sinks.EmitResult result = roomStatusUpdateSink.tryEmitNext(message);
            if (result.isFailure()) {
                log.warn("Failed to emit room status update for room {}: {}", 
                    payload.roomId(), result);
            } else {
                log.debug("Successfully published room update for room {}", payload.roomId());
            }
            
        } catch (Exception e) {
            log.warn("Exception during immediate room update publish for room {}: {}", 
                payload.roomId(), e.getMessage());
        }
    }
    
    /**
     * Update priority levels for controlling debouncing behavior.
     */
    public enum UpdatePriority {
        USER_INITIATED,  // Immediate publish - user actions
        SYSTEM,          // Immediate publish - system events
        AUTOMATIC        // Debounced publish - automatic updates
    }
    
    /**
     * Internal class to track pending room updates for debouncing.
     */
    private static class PendingRoomUpdate {
        private final AtomicReference<RoomStatusUpdatePayload> latestPayload;
        private volatile UpdatePriority highestPriority;
        private final Instant createdAt;
        private volatile Instant lastUpdated;
        
        public PendingRoomUpdate(RoomStatusUpdatePayload payload, UpdatePriority priority) {
            this.latestPayload = new AtomicReference<>(payload);
            this.highestPriority = priority;
            this.createdAt = Instant.now();
            this.lastUpdated = this.createdAt;
        }
        
        public void updatePayload(RoomStatusUpdatePayload payload, UpdatePriority priority) {
            this.latestPayload.set(payload);
            this.lastUpdated = Instant.now();
            
            // Upgrade priority if higher priority update comes in
            if (priority.ordinal() < this.highestPriority.ordinal()) {
                this.highestPriority = priority;
            }
        }
        
        public RoomStatusUpdatePayload getLatestPayload() {
            return latestPayload.get();
        }
        
        public UpdatePriority getHighestPriority() {
            return highestPriority;
        }
        
        public Instant getCreatedAt() {
            return createdAt;
        }
        
        public Instant getLastUpdated() {
            return lastUpdated;
        }
        
        public boolean isStale(Duration maxAge) {
            return Duration.between(lastUpdated, Instant.now()).compareTo(maxAge) > 0;
        }
    }
    
    /**
     * Internal class to collect and batch room updates within a time window.
     */
    private static class BatchCollector {
        private final String batchKey;
        private final List<RoomStatusUpdatePayload> updates;
        private final Instant createdAt;
        private volatile Instant lastUpdated;
        private volatile boolean flushScheduled;
        
        public BatchCollector(String batchKey) {
            this.batchKey = batchKey;
            this.updates = new ArrayList<>();
            this.createdAt = Instant.now();
            this.lastUpdated = this.createdAt;
            this.flushScheduled = false;
        }
        
        public synchronized void addUpdates(List<RoomStatusUpdatePayload> newUpdates) {
            this.updates.addAll(newUpdates);
            this.lastUpdated = Instant.now();
        }
        
        public synchronized void addUpdate(RoomStatusUpdatePayload update) {
            this.updates.add(update);
            this.lastUpdated = Instant.now();
        }
        
        public synchronized List<RoomStatusUpdatePayload> getAndClearUpdates() {
            List<RoomStatusUpdatePayload> result = new ArrayList<>(updates);
            updates.clear();
            return result;
        }
        
        public synchronized boolean shouldFlush() {
            return updates.size() >= MAX_BATCH_SIZE || 
                   Duration.between(createdAt, Instant.now()).compareTo(BATCH_WINDOW) > 0;
        }
        
        public synchronized boolean isEmpty() {
            return updates.isEmpty();
        }
        
        public boolean isOld() {
            return Duration.between(lastUpdated, Instant.now()).compareTo(Duration.ofMinutes(5)) > 0;
        }
        
        public String getBatchKey() {
            return batchKey;
        }
        
        public synchronized int size() {
            return updates.size();
        }
        
        public boolean isFlushScheduled() {
            return flushScheduled;
        }
        
        public void setFlushScheduled(boolean flushScheduled) {
            this.flushScheduled = flushScheduled;
        }
    }
}
