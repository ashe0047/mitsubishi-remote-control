package com.ashelabs.turing.config;

import com.ashelabs.turing.service.RoomWebSocketService;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.RoomStatusUpdateMessage;
import com.ashelabs.turing.websocket.airconditioner.messages.outbound.BatchedRoomUpdateMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import reactor.core.publisher.Sinks;

/**
 * Configuration for room WebSocket services and message sinks.
 * 
 * This configuration provides the necessary beans for room-level WebSocket
 * communication including message sinks and the room WebSocket service.
 */
@Configuration
@EnableScheduling
@Slf4j
public class RoomWebSocketConfig {

    @Autowired
    @Lazy
    private RoomWebSocketService roomWebSocketService;

    /**
     * Create RoomWebSocketService bean with required dependencies.
     * 
     * @param roomStatusUpdateSink Sink for room status updates
     * @param batchedRoomUpdateSink Sink for batched room updates
     * @return Configured RoomWebSocketService instance
     */
    @Bean
    public RoomWebSocketService roomWebSocketService(
            Sinks.Many<RoomStatusUpdateMessage> roomStatusUpdateSink,
            Sinks.Many<BatchedRoomUpdateMessage> batchedRoomUpdateSink) {
        
        log.info("Creating RoomWebSocketService with WebSocket sinks");
        return new RoomWebSocketService(roomStatusUpdateSink, batchedRoomUpdateSink);
    }

    /**
     * Scheduled cleanup task for WebSocket service.
     * 
     * This task runs every 5 minutes to clean up stale pending updates
     * and old batch collectors to prevent memory leaks.
     */
    @Scheduled(fixedRate = 300000) // 5 minutes
    public void cleanupWebSocketService() {
        try {
            log.debug("Running scheduled WebSocket service cleanup");
            roomWebSocketService.cleanup();
        } catch (Exception e) {
            log.warn("Error during scheduled WebSocket service cleanup: {}", e.getMessage());
        }
    }
}