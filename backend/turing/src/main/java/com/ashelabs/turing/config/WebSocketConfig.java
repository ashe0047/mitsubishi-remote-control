package com.ashelabs.turing.config;

import com.ashelabs.turing.websocket.AirConditionerWebSocketHandler;
import com.ashelabs.turing.websocket.QuotaWebSocketHandler;
import com.ashelabs.turing.websocket.WebSocketJwtAuthHandler;
import com.ashelabs.turing.service.JwtService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.HandlerMapping;
import org.springframework.web.reactive.handler.SimpleUrlHandlerMapping;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.server.support.WebSocketHandlerAdapter;

import java.util.HashMap;
import java.util.Map;

/**
 * WebSocket configuration for unified handler architecture.
 *
 * <p>URL Pattern: /ws/{feature}?{context-params}
 *
 * <p>Maps WebSocket endpoints to handlers with JWT authentication:
 * <ul>
 *   <li>/ws/airconditioner - Air conditioner control (AirConditionerWebSocketHandler)</li>
 *   <li>/ws/quota - Quota management (QuotaWebSocketHandler)</li>
 * </ul>
 *
 * <p>Query Parameters:
 * <ul>
 *   <li>roomId - Room identifier</li>
 *   <li>familyMemberId - User/family member identifier</li>
 *   <li>quotaId - Quota identifier (for /ws/quota only)</li>
 *   <li>token - JWT authentication token</li>
 * </ul>
 *
 * <p>All handlers extend BaseWebSocketHandler and use Command Pattern.
 *
 * @see AirConditionerWebSocketHandler
 * @see QuotaWebSocketHandler
 * @see com.ashelabs.turing.websocket.core.BaseWebSocketHandler
 */
@Configuration
public class WebSocketConfig {

    @Bean
    public HandlerMapping webSocketHandlerMapping(
            AirConditionerWebSocketHandler airConditionerHandler,
            QuotaWebSocketHandler quotaWebSocketHandler,
            JwtService jwtService) {

        // Wrap handlers with JWT authentication decorator
        WebSocketHandler securedAirConditionerHandler = new WebSocketJwtAuthHandler(airConditionerHandler, jwtService);
        WebSocketHandler securedQuotaWebSocketHandler = new WebSocketJwtAuthHandler(quotaWebSocketHandler, jwtService);

        // URL Pattern: /ws/{feature}
        Map<String, WebSocketHandler> map = new HashMap<>();
        map.put("/ws/airconditioner", securedAirConditionerHandler);  // Air conditioner control
        map.put("/ws/quota", securedQuotaWebSocketHandler);           // Quota management

        SimpleUrlHandlerMapping handlerMapping = new SimpleUrlHandlerMapping();
        handlerMapping.setUrlMap(map);
        handlerMapping.setOrder(1);
        return handlerMapping;
    }

    @Bean
    public WebSocketHandlerAdapter handlerAdapter() {
        return new WebSocketHandlerAdapter();
    }
}