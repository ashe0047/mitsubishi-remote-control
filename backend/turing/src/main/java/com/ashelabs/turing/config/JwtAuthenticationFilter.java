package com.ashelabs.turing.config;

import com.ashelabs.turing.service.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * JWT Authentication Filter for Spring WebFlux.
 * Extracts and validates JWT tokens from Authorization header and sets authentication context.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter implements WebFilter {

    private final JwtService jwtService;
    private static final String BEARER_PREFIX = "Bearer ";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();

        // Skip authentication for public endpoints
        if (isPublicEndpoint(path)) {
            return chain.filter(exchange);
        }

        // Extract JWT token from Authorization header
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            // No token present - let Spring Security handle authorization
            return chain.filter(exchange);
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        try {
            // Validate token
            if (!jwtService.validateToken(token)) {
                log.debug("Invalid JWT token for request: {}", path);
                return this.unauthorized(exchange);
            }

            // Extract user information
            JwtService.JwtUserInfo userInfo = jwtService.extractUserInfo(token);

            // Create Spring Security authentication with role
            // Convert role to Spring Security authority format (ROLE_PARENT, ROLE_CHILD, etc.)
            String authority = "ROLE_" + userInfo.getRole().toUpperCase();
            List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority(authority));

            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    userInfo.getEmail(),
                    null,
                    authorities
            );
            authentication.setDetails(userInfo);

            log.debug("JWT authentication successful for user: {} with role: {}", userInfo.getEmail(), userInfo.getRole());

            // Set authentication in reactive security context and continue filter chain
            SecurityContextImpl securityContext = new SecurityContextImpl(authentication);

            return chain.filter(exchange)
                .contextWrite(ReactiveSecurityContextHolder.withSecurityContext(Mono.just(securityContext)));

        } catch (Exception e) {
            log.warn("JWT authentication failed for request: {}: {}", path, e.getMessage());
            return this.unauthorized(exchange);
        }
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }

    /**
     * Check if the endpoint is public and doesn't require authentication
     */
    private boolean isPublicEndpoint(String path) {
        return path.startsWith("/api/auth/") ||
               path.startsWith("/actuator/") ||
               path.startsWith("/swagger-ui/") ||
               path.startsWith("/v3/api-docs/") ||
               path.startsWith("/ws/"); // WebSocket has its own authentication
    }
}
