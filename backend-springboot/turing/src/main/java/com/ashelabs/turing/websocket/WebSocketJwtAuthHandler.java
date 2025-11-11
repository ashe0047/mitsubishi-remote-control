package com.ashelabs.turing.websocket;

import com.ashelabs.turing.service.JwtService;
import com.ashelabs.turing.service.JwtService.JwtUserInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * WebSocket handler decorator that adds JWT authentication to any WebSocket handler.
 * 
 * This handler validates JWT tokens passed as query parameters and stores user
 * information in the WebSocket session attributes for use by the underlying handler.
 */
@Slf4j
public class WebSocketJwtAuthHandler implements WebSocketHandler {
    
    private final WebSocketHandler delegate;
    private final JwtService jwtService;
    
    public WebSocketJwtAuthHandler(WebSocketHandler delegate, JwtService jwtService) {
        this.delegate = delegate;
        this.jwtService = jwtService;
    }
    
    @Override
    @NonNull
    public Mono<Void> handle(@NonNull WebSocketSession session) {
        return authenticateSession(session)
                .flatMap(authenticatedSession -> delegate.handle(authenticatedSession))
                .onErrorResume(this::handleAuthenticationError);
    }
    
    private Mono<WebSocketSession> authenticateSession(WebSocketSession session) {
        return Mono.fromCallable(() -> {
            URI uri = session.getHandshakeInfo().getUri();
            Map<String, List<String>> queryParams = UriComponentsBuilder.fromUri(uri).build().getQueryParams();

            log.info("WebSocket authentication attempt: uri={}, queryParams={}", uri, queryParams);

            // Extract JWT token from query parameters
            String token = extractTokenFromQuery(queryParams);
            if (token == null) {
                // Check Authorization header as fallback
                token = extractTokenFromHeaders(session);
            }

            if (token == null) {
                log.error("WebSocket authentication failed: No JWT token provided. URI: {}, QueryParams: {}", uri, queryParams);
                throw new WebSocketAuthenticationException("No JWT token provided. Add 'token' query parameter or Authorization header.");
            }

            log.debug("WebSocket authentication: Extracted token: {}...", token.substring(0, Math.min(20, token.length())));

            try {
                // Validate JWT token and extract user information
                JwtUserInfo userInfo = jwtService.extractUserInfo(token);

                // Store user information in session attributes
                session.getAttributes().put("userInfo", userInfo);
                session.getAttributes().put("userId", userInfo.getUserId());
                session.getAttributes().put("householdId", userInfo.getHouseholdId());
                session.getAttributes().put("userRole", userInfo.getRole());

                log.info("WebSocket authenticated successfully: user={}, household={}, endpoint={}",
                        userInfo.getUserId(), userInfo.getHouseholdId(), uri.getPath());

                return session;
            } catch (Exception e) {
                log.error("WebSocket JWT token validation failed: {}, token: {}...", e.getMessage(), token.substring(0, Math.min(20, token.length())));
                throw new WebSocketAuthenticationException("JWT token validation failed: " + e.getMessage(), e);
            }
        });
    }
    
    private String extractTokenFromQuery(Map<String, List<String>> queryParams) {
        List<String> tokenParams = queryParams.get("token");
        if (tokenParams != null && !tokenParams.isEmpty()) {
            return tokenParams.get(0);
        }
        
        // Also check for 'jwt' parameter as alternative
        List<String> jwtParams = queryParams.get("jwt");
        if (jwtParams != null && !jwtParams.isEmpty()) {
            return jwtParams.get(0);
        }
        
        return null;
    }
    
    private String extractTokenFromHeaders(WebSocketSession session) {
        List<String> authHeaders = session.getHandshakeInfo().getHeaders().get("Authorization");
        if (authHeaders != null && !authHeaders.isEmpty()) {
            String authHeader = authHeaders.get(0);
            if (authHeader.startsWith("Bearer ")) {
                return authHeader.substring(7);
            }
        }
        
        // Check WebSocket subprotocols for Bearer token (workaround for browser limitations)
        String subprotocol = session.getHandshakeInfo().getSubProtocol();
        if (subprotocol != null && subprotocol.startsWith("Bearer.")) {
            return subprotocol.substring(7); // Remove "Bearer." prefix
        }
        
        return null;
    }
    
    private Mono<Void> handleAuthenticationError(Throwable error) {
        log.warn("WebSocket authentication failed: {}", error.getMessage());
        // WebSocket authentication failures result in connection closure
        // The client will receive a close frame with the error
        return Mono.error(error);
    }
    
    /**
     * Custom exception for WebSocket authentication failures
     */
    public static class WebSocketAuthenticationException extends RuntimeException {
        public WebSocketAuthenticationException(String message) {
            super(message);
        }
        
        public WebSocketAuthenticationException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}