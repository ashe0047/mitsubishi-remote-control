package com.ashelabs.turing.service;

import com.ashelabs.turing.dto.AirConSettings;
import com.ashelabs.turing.entity.UsageSession;
import com.ashelabs.turing.entity.SessionStatus;
import com.ashelabs.turing.repository.UsageSessionRepository;
import com.ashelabs.turing.repository.QuotaRepository;
import com.ashelabs.turing.service.MqttStateUpdateEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Service for tracking AC usage sessions and updating quota consumption.
 * 
 * This service handles the lifecycle of AC usage sessions, from start to end,
 * and ensures accurate quota consumption tracking for enforcement purposes.
 */
@Service
@Slf4j
public class UsageTrackingService {
    
    private final UsageSessionRepository sessionRepository;
    private final QuotaRepository quotaRepository;
    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    private final QuotaNotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;
    
    // Cache configuration
    private static final Duration SESSION_CACHE_TTL = Duration.ofHours(24);
    private static final String ACTIVE_SESSION_KEY_PREFIX = "quota:session:active:";
    
    @Autowired
    public UsageTrackingService(
            UsageSessionRepository sessionRepository,
            QuotaRepository quotaRepository,
            ReactiveRedisTemplate<String, Object> redisTemplate,
            QuotaNotificationService notificationService,
            ApplicationEventPublisher eventPublisher) {
        this.sessionRepository = sessionRepository;
        this.quotaRepository = quotaRepository;
        this.redisTemplate = redisTemplate;
        this.notificationService = notificationService;
        this.eventPublisher = eventPublisher;
    }
    
    /**
     * Handles AC state changes for usage tracking.
     * Processes asynchronously to avoid blocking MQTT flow.
     * 
     * @param event MQTT state update event containing room and state information
     */
    @EventListener
    @Async("usageTrackingExecutor")
    public void handleAirConStateChange(MqttStateUpdateEvent event) {
        // Extract user context from event
        UUID userId = extractUserFromEvent(event);
        if (userId == null) {
            log.debug("No user context for state change in room {}, skipping usage tracking", 
                event.getRoomId());
            return;
        }
        
        String roomId = event.getRoomId();
        String powerState = event.getState().getMode(); // Use mode as power indicator since no power field exists
        
        log.debug("Processing AC state change: user={}, room={}, power={}", userId, roomId, powerState);
        
        if (!"off".equalsIgnoreCase(powerState)) { // Any mode other than "off" means AC is on
            handleACPowerOn(userId, roomId, event.getState())
                .doOnSuccess(session -> log.info("Started usage session {} for user {} in room {}", 
                    session.getId(), userId, roomId))
                .doOnError(error -> log.error("Failed to start usage session for user {} room {}", 
                    userId, roomId, error))
                .subscribe();
        } else if ("off".equalsIgnoreCase(powerState)) {
            handleACPowerOff(userId, roomId)
                .doOnSuccess(session -> {
                    if (session != null) {
                        log.info("Ended usage session {} for user {} in room {} after {} minutes", 
                            session.getId(), userId, roomId, session.getDurationMinutes());
                    }
                })
                .doOnError(error -> log.error("Failed to end usage session for user {} room {}", 
                    userId, roomId, error))
                .subscribe();
        }
    }
    
    /**
     * Starts a new usage session when AC turns on.
     * 
     * @param userId ID of the user starting the session
     * @param roomId room where AC is being used
     * @param initialSettings AC settings when session started
     * @return Mono that emits the created usage session
     */
    public Mono<UsageSession> startUsageSession(
            UUID userId, 
            String roomId, 
            AirConSettings initialSettings) {
        
        // Check if there's already an active session and end it first
        return sessionRepository.findActiveSession(userId, roomId)
            .flatMap(existingSession -> {
                log.warn("Found existing active session {} for user {} room {}, ending it first", 
                    existingSession.getId(), userId, roomId);
                return endUsageSession(existingSession.getId());
            })
            .then(createNewUsageSession(userId, roomId, initialSettings))
            .doOnNext(session -> cacheActiveSession(userId, roomId, session));
    }
    
    /**
     * Ends an active usage session when AC turns off.
     * 
     * @param sessionId ID of the session to end
     * @return Mono that emits the completed usage session
     */
    public Mono<UsageSession> endUsageSession(UUID sessionId) {
        return sessionRepository.findById(sessionId)
            .flatMap(session -> {
                if (session.getStatus() != SessionStatus.ACTIVE) {
                    log.warn("Attempting to end non-active session {}: status={}", 
                        sessionId, session.getStatus());
                    return Mono.just(session);
                }
                
                return completeUsageSession(session);
            })
            .doOnNext(session -> {
                // Update quota usage and clear cache
                updateQuotaUsage(session.getUserId(), session.getRoomId(), 
                    session.getDurationMinutes()).subscribe();
                clearActiveSessionCache(session.getUserId(), session.getRoomId());
            })
            .doOnNext(this::checkQuotaThresholds);
    }
    
    /**
     * Finds and ends any active session for a user in a specific room.
     * 
     * @param userId ID of the user
     * @param roomId room ID
     * @return Mono that emits the ended session or empty if no active session
     */
    public Mono<UsageSession> endActiveSession(UUID userId, String roomId) {
        return sessionRepository.findActiveSession(userId, roomId)
            .flatMap(session -> endUsageSession(session.getId()))
            .doOnNext(session -> log.info("Ended active session for user {} room {}", userId, roomId));
    }
    
    /**
     * Gets the currently active session for a user in a room.
     * 
     * @param userId ID of the user
     * @param roomId room ID
     * @return Mono that emits the active session or empty if none
     */
    public Mono<UsageSession> getActiveSession(UUID userId, String roomId) {
        // Try cache first, then database
        return getCachedActiveSession(userId, roomId)
            .switchIfEmpty(sessionRepository.findActiveSession(userId, roomId)
                .doOnNext(session -> cacheActiveSession(userId, roomId, session)));
    }
    
    // Private implementation methods
    
    private Mono<UsageSession> handleACPowerOn(UUID userId, String roomId, com.ashelabs.turing.dto.AirConState state) {
        AirConSettings settings = AirConSettings.builder()
            .power("on") // Set power to "on" since we determined AC is running
            .temperature(state.getTemperature())
            .mode(state.getMode())
            .fan(state.getFan())
            .vane(state.getVane())
            .wideVane(state.getWideVane())
            .build();
        
        return startUsageSession(userId, roomId, settings);
    }
    
    private Mono<UsageSession> handleACPowerOff(UUID userId, String roomId) {
        return endActiveSession(userId, roomId);
    }
    
    private Mono<UsageSession> createNewUsageSession(UUID userId, String roomId, AirConSettings initialSettings) {
        UsageSession newSession = UsageSession.builder()
            .userId(userId)
            .roomId(roomId)
            .startedAt(java.time.Instant.now()) // Use Instant instead of LocalDateTime
            .status(SessionStatus.ACTIVE)
            .initialSettings(convertSettingsToJsonNode(initialSettings))
            .build();
        
        return sessionRepository.save(newSession)
            .doOnNext(session -> log.debug("Created new usage session: {}", session.getId()));
    }
    
    private Mono<UsageSession> completeUsageSession(UsageSession session) {
        java.time.Instant endTime = java.time.Instant.now();
        long durationMinutes = Duration.between(session.getStartedAt(), endTime).toMinutes();
        
        // Update session with end information
        session.setEndedAt(endTime);
        session.setDurationMinutes(Math.toIntExact(durationMinutes));
        session.setStatus(SessionStatus.COMPLETED);
        
        return sessionRepository.save(session)
            .doOnNext(updatedSession -> log.debug("Completed usage session {} after {} minutes", 
                updatedSession.getId(), durationMinutes));
    }
    
    private Mono<Void> updateQuotaUsage(UUID userId, String roomId, Integer durationMinutes) {
        if (durationMinutes == null || durationMinutes <= 0) {
            return Mono.empty();
        }
        
        // For now, we need to find the quota ID first, then increment usage
        // This is a simplified implementation - in practice you'd get the quota ID from the session
        return quotaRepository.findActiveQuotaByUserAndRoom(userId, roomId, java.time.LocalDate.now())
            .flatMap(quota -> quotaRepository.incrementDailyUsage(quota.getId(), durationMinutes * 60) // Convert minutes to seconds
                .map(updated -> quota)) // Return the original quota for WebSocket broadcasting
            .doOnNext(quota -> {
                log.debug("Updated quota usage for user {} room {}: +{}min", userId, roomId, durationMinutes);
                
                // Broadcast quota update via WebSocket
                double currentUsageHours = quota.getUsedAmount().doubleValue();
                double dailyLimitHours = quota.getAllowedAmount().doubleValue();
                double usagePercent = (currentUsageHours / dailyLimitHours) * 100.0;
                
                String status = usagePercent >= 100 ? "EXCEEDED" : 
                               usagePercent >= 80 ? "WARNING" : "ACTIVE";
                
                // Publish quota update event for WebSocket broadcasting
                eventPublisher.publishEvent(new QuotaUpdateEvent(
                    this,
                    quota.getId().toString(),
                    userId.toString(),
                    roomId,
                    currentUsageHours,
                    dailyLimitHours,
                    status,
                    isCurrentlyActive(userId, roomId),
                    0.0 // estimatedSessionUsage - could be calculated from current session
                ));
            })
            .then();
    }
    
    private boolean isCurrentlyActive(UUID userId, String roomId) {
        // Check if there's an active session in cache
        String cacheKey = activeSessionKey(userId, roomId);
        return redisTemplate.hasKey(cacheKey).block(Duration.ofSeconds(1)) == Boolean.TRUE;
    }
    
    private void checkQuotaThresholds(UsageSession session) {
        // Check if usage triggers any quota warnings or violations
        quotaRepository.findActiveQuotaByUserAndRoom(
            session.getUserId(), 
            session.getRoomId(), 
            session.getStartedAt().atZone(java.time.ZoneId.systemDefault()).toLocalDate())
            .flatMap(quota -> {
                // Calculate current usage percentage
                double usageHours = quota.getUsedAmount().doubleValue();
                double limitHours = quota.getAllowedAmount().doubleValue();
                double usagePercent = (usageHours / limitHours) * 100.0;
                
                // Send notifications based on thresholds
                if (quota.getWarningThresholds() != null) {
                    for (Integer threshold : quota.getWarningThresholds()) {
                        if (usagePercent >= threshold) {
                            // Send traditional notification
                            notificationService.sendQuotaThresholdAlert(
                                session.getUserId(), quota, usagePercent, threshold)
                                .subscribe();
                            
                            // Publish violation alert event for WebSocket broadcasting
                            String violationType = usagePercent >= 100 ? "LIMIT_EXCEEDED" : "WARNING_THRESHOLD";
                            eventPublisher.publishEvent(new QuotaViolationEvent(
                                this,
                                quota.getId().toString(),
                                session.getUserId().toString(),
                                "User " + session.getUserId(), // TODO: Get actual user name
                                session.getRoomId(),
                                session.getRoomId(), // TODO: Get actual room name
                                violationType,
                                usagePercent,
                                100.0 // limit percentage
                            ));
                            
                            return Mono.empty();
                        }
                    }
                }
                
                return Mono.empty();
            })
            .subscribe(
                result -> log.debug("Quota threshold check completed for session {}", session.getId()),
                error -> log.error("Error checking quota thresholds for session {}", session.getId(), error)
            );
    }
    
    // Cache management methods
    
    private void cacheActiveSession(UUID userId, String roomId, UsageSession session) {
        String cacheKey = activeSessionKey(userId, roomId);
        redisTemplate.opsForValue()
            .set(cacheKey, session, SESSION_CACHE_TTL)
            .subscribe(
                result -> log.debug("Cached active session: {}", cacheKey),
                error -> log.warn("Failed to cache active session: {}", cacheKey, error)
            );
    }
    
    private Mono<UsageSession> getCachedActiveSession(UUID userId, String roomId) {
        String cacheKey = activeSessionKey(userId, roomId);
        return redisTemplate.opsForValue()
            .get(cacheKey)
            .cast(UsageSession.class)
            .doOnNext(session -> log.debug("Cache hit for active session: {}", cacheKey))
            .onErrorResume(error -> {
                log.debug("Cache miss or error for active session: {}", cacheKey);
                return Mono.empty();
            });
    }
    
    private void clearActiveSessionCache(UUID userId, String roomId) {
        String cacheKey = activeSessionKey(userId, roomId);
        redisTemplate.delete(cacheKey)
            .subscribe(
                deleted -> log.debug("Cleared active session cache: {} (deleted: {})", cacheKey, deleted),
                error -> log.warn("Failed to clear active session cache: {}", cacheKey, error)
            );
    }
    
    // Utility methods
    
    private String activeSessionKey(UUID userId, String roomId) {
        return ACTIVE_SESSION_KEY_PREFIX + userId + ":" + roomId;
    }
    
    private com.fasterxml.jackson.databind.JsonNode convertSettingsToJsonNode(AirConSettings settings) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return objectMapper.valueToTree(settings);
        } catch (Exception e) {
            log.warn("Failed to convert AC settings to JSON node", e);
            com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return objectMapper.createObjectNode();
        }
    }
    
    /**
     * Extracts user ID from MQTT state update event.
     * This is a placeholder implementation - will need to be updated
     * when user context is properly integrated with MQTT events.
     * 
     * @param event MQTT state update event
     * @return user ID if available, null otherwise
     */
    private UUID extractUserFromEvent(MqttStateUpdateEvent event) {
        // TODO: Implement proper user context extraction from MQTT events
        // This might involve:
        // 1. Session tracking based on WebSocket connections
        // 2. Device/room assignment lookup
        // 3. Authentication token correlation
        
        // For now, return null to skip usage tracking until user context is implemented
        log.debug("User context extraction not implemented yet for room: {}", event.getRoomId());
        return null;
    }
}