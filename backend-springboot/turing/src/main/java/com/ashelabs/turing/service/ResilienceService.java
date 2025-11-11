package com.ashelabs.turing.service;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.function.Function;

public interface ResilienceService {

    <T> Mono<T> withCircuitBreaker(String name, Mono<T> operation);

    <T> Flux<T> withCircuitBreaker(String name, Flux<T> operation);

    <T> Mono<T> withRetry(Mono<T> operation, int maxAttempts, Duration minBackoff, Duration maxBackoff);

    <T> Flux<T> withRetry(Flux<T> operation, int maxAttempts, Duration minBackoff, Duration maxBackoff);

    <T> Mono<T> withTimeout(Mono<T> operation, Duration timeout);

    <T> Flux<T> withTimeout(Flux<T> operation, Duration timeout);

    <T> Mono<T> withFallback(Mono<T> operation, Function<Throwable, Mono<T>> fallback);

    <T> Flux<T> withFallback(Flux<T> operation, Function<Throwable, Flux<T>> fallback);

    <T> Mono<T> withRetryAndCircuitBreaker(String circuitBreakerName, Mono<T> operation, 
                                          int maxAttempts, Duration minBackoff, Duration maxBackoff);

    CircuitBreakerState getCircuitBreakerState(String name);

    Mono<Void> resetCircuitBreaker(String name);

    enum CircuitBreakerState {
        CLOSED, OPEN, HALF_OPEN
    }
}