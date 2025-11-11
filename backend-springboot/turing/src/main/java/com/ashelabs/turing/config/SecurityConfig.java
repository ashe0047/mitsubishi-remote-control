package com.ashelabs.turing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableReactiveMethodSecurity;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.SecurityWebFiltersOrder;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.server.SecurityWebFilterChain;

/**
 * Security configuration for the Mitsubishi Controller application.
 * Integrates JWT authentication for protected API endpoints.
 */
@Configuration
@EnableWebFluxSecurity
@EnableReactiveMethodSecurity // Enable @PreAuthorize annotations
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(csrf -> csrf.disable())
                // Add JWT authentication filter before authorization
                .addFilterAt(jwtAuthenticationFilter, SecurityWebFiltersOrder.AUTHENTICATION)
                .authorizeExchange(exchanges -> exchanges
                        // Allow unrestricted access to authentication endpoints
                        .pathMatchers("/api/auth/**").permitAll()
                        // Allow unrestricted access to actuator endpoints (for health checks)
                        .pathMatchers("/actuator/**").permitAll()
                        // Allow unrestricted access to API documentation
                        .pathMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        // Allow OPTIONS requests for CORS preflight (must be before authenticated paths)
                        .pathMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                        // Require authentication for all API endpoints
                        .pathMatchers("/api/**").authenticated()
                        // Allow WebSocket connections (they have their own JWT authentication)
                        .pathMatchers("/ws/**").permitAll()
                        // Require authentication for all other paths
                        .anyExchange().authenticated()
                )
                .httpBasic(httpBasic -> httpBasic.disable())
                .formLogin(formLogin -> formLogin.disable())
                .build();
    }
    
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}