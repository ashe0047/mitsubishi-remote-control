package com.ashelabs.turing.config;

import com.ashelabs.turing.handler.AirConHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.server.HandlerFilterFunction;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;

import static org.springframework.web.reactive.function.server.RequestPredicates.*;

@Configuration
public class AirConRouterConfig {

    @Bean
    public RouterFunction<ServerResponse> airConRoutes(AirConHandler handler) {
        return RouterFunctions.route()
                // Room information endpoints (legacy device-specific endpoints)
                // Note: /api/rooms is now handled by UnifiedRoomController
                .GET("/api/rooms/{roomId}/state", handler::getRoomState)
                .GET("/api/rooms/{roomId}/settings", handler::getRoomSettings)
                
                // AC control command endpoints
                .POST("/api/rooms/{roomId}/power", 
                    accept(MediaType.APPLICATION_JSON).or(accept(MediaType.TEXT_PLAIN)), 
                    handler::setPower)
                .POST("/api/rooms/{roomId}/temperature", 
                    accept(MediaType.APPLICATION_JSON).or(accept(MediaType.TEXT_PLAIN)), 
                    handler::setTemperature)
                .POST("/api/rooms/{roomId}/mode", 
                    accept(MediaType.APPLICATION_JSON).or(accept(MediaType.TEXT_PLAIN)), 
                    handler::setMode)
                .POST("/api/rooms/{roomId}/fan", 
                    accept(MediaType.APPLICATION_JSON).or(accept(MediaType.TEXT_PLAIN)), 
                    handler::setFan)
                .POST("/api/rooms/{roomId}/vane", 
                    accept(MediaType.APPLICATION_JSON).or(accept(MediaType.TEXT_PLAIN)), 
                    handler::setVane)
                .POST("/api/rooms/{roomId}/widevane", 
                    accept(MediaType.APPLICATION_JSON).or(accept(MediaType.TEXT_PLAIN)), 
                    handler::setWideVane)
                
                // Settings update endpoint
                .PUT("/api/rooms/{roomId}/settings", 
                    accept(MediaType.APPLICATION_JSON), 
                    handler::updateSettings)
                
                // MQTT status endpoint
                .GET("/api/rooms/mqtt/status", handler::getMqttStatus)
                
                // Apply filters to all routes
                .filter(errorHandlingFilter())
                .build();
    }

    @Bean
    public HandlerFilterFunction<ServerResponse, ServerResponse> errorHandlingFilter() {
        return (request, next) -> {
            return next.handle(request)
                .onErrorResume(IllegalArgumentException.class, 
                    error -> ServerResponse.badRequest()
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue("{\"error\":\"" + error.getMessage() + "\"}"))
                .onErrorResume(Exception.class, 
                    error -> ServerResponse.status(500)
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue("{\"error\":\"Internal server error\"}"));
        };
    }
}