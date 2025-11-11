package com.ashelabs.turing.service.impl;

import com.ashelabs.turing.service.ResilienceService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;

@Slf4j
@Service
public class ResilienceServiceImpl implements ResilienceService {

    private final ConcurrentMap<String, CircuitBreaker> circuitBreakers = new ConcurrentHashMap<>();
    
    private static final int DEFAULT_FAILURE_THRESHOLD = 5;
    private static final Duration DEFAULT_TIMEOUT_DURATION = Duration.ofSeconds(60);
    private static final Duration DEFAULT_HALF_OPEN_DURATION = Duration.ofSeconds(30);

    @Override
    public <T> Mono<T> withCircuitBreaker(String name, Mono<T> operation) {
        CircuitBreaker circuitBreaker = getOrCreateCircuitBreaker(name);
        
        return Mono.defer(() -> {
            if (circuitBreaker.isOpen()) {
                log.debug("Circuit breaker {} is open, failing fast", name);
                return Mono.error(new CircuitBreakerOpenException("Circuit breaker " + name + " is open"));
            }
            
            return operation
                .doOnSuccess(result -> circuitBreaker.recordSuccess())
                .doOnError(error -> {
                    circuitBreaker.recordFailure();
                    log.debug("Circuit breaker {} recorded failure: {}", name, error.getMessage());
                });
        });
    }

    @Override
    public <T> Flux<T> withCircuitBreaker(String name, Flux<T> operation) {
        CircuitBreaker circuitBreaker = getOrCreateCircuitBreaker(name);
        
        return Flux.defer(() -> {
            if (circuitBreaker.isOpen()) {
                log.debug("Circuit breaker {} is open, failing fast", name);
                return Flux.error(new CircuitBreakerOpenException("Circuit breaker " + name + " is open"));
            }
            
            return operation
                .doOnComplete(() -> circuitBreaker.recordSuccess())
                .doOnError(error -> {
                    circuitBreaker.recordFailure();
                    log.debug("Circuit breaker {} recorded failure: {}", name, error.getMessage());
                });
        });
    }

    @Override
    public <T> Mono<T> withRetry(Mono<T> operation, int maxAttempts, Duration minBackoff, Duration maxBackoff) {
        return operation.retryWhen(
            Retry.backoff(maxAttempts, minBackoff)
                .maxBackoff(maxBackoff)
                .filter(this::isRetryableException)
                .doBeforeRetry(retrySignal -> 
                    log.debug("Retrying operation (attempt {}): {}", 
                        retrySignal.totalRetries() + 1, retrySignal.failure().getMessage()))
        );
    }

    @Override
    public <T> Flux<T> withRetry(Flux<T> operation, int maxAttempts, Duration minBackoff, Duration maxBackoff) {
        return operation.retryWhen(
            Retry.backoff(maxAttempts, minBackoff)
                .maxBackoff(maxBackoff)
                .filter(this::isRetryableException)
                .doBeforeRetry(retrySignal -> 
                    log.debug("Retrying operation (attempt {}): {}", 
                        retrySignal.totalRetries() + 1, retrySignal.failure().getMessage()))
        );
    }

    @Override
    public <T> Mono<T> withTimeout(Mono<T> operation, Duration timeout) {
        return operation.timeout(timeout)
            .doOnError(error -> log.debug("Operation timed out after {}: {}", timeout, error.getMessage()));
    }

    @Override
    public <T> Flux<T> withTimeout(Flux<T> operation, Duration timeout) {
        return operation.timeout(timeout)
            .doOnError(error -> log.debug("Operation timed out after {}: {}", timeout, error.getMessage()));
    }

    @Override
    public <T> Mono<T> withFallback(Mono<T> operation, Function<Throwable, Mono<T>> fallback) {
        return operation.onErrorResume(error -> {
            log.debug("Operation failed, executing fallback: {}", error.getMessage());
            return fallback.apply(error);
        });
    }

    @Override
    public <T> Flux<T> withFallback(Flux<T> operation, Function<Throwable, Flux<T>> fallback) {
        return operation.onErrorResume(error -> {
            log.debug("Operation failed, executing fallback: {}", error.getMessage());
            return fallback.apply(error);
        });
    }

    @Override
    public <T> Mono<T> withRetryAndCircuitBreaker(String circuitBreakerName, Mono<T> operation, 
                                                 int maxAttempts, Duration minBackoff, Duration maxBackoff) {
        return withCircuitBreaker(circuitBreakerName, 
            withRetry(operation, maxAttempts, minBackoff, maxBackoff));
    }

    @Override
    public CircuitBreakerState getCircuitBreakerState(String name) {
        CircuitBreaker circuitBreaker = circuitBreakers.get(name);
        if (circuitBreaker == null) {
            return CircuitBreakerState.CLOSED;
        }
        return circuitBreaker.getState();
    }

    @Override
    public Mono<Void> resetCircuitBreaker(String name) {
        return Mono.fromRunnable(() -> {
            CircuitBreaker circuitBreaker = circuitBreakers.get(name);
            if (circuitBreaker != null) {
                circuitBreaker.reset();
                log.info("Reset circuit breaker: {}", name);
            }
        });
    }

    private CircuitBreaker getOrCreateCircuitBreaker(String name) {
        return circuitBreakers.computeIfAbsent(name, k -> new CircuitBreaker(name));
    }

    private boolean isRetryableException(Throwable throwable) {
        return !(throwable instanceof IllegalArgumentException) &&
               !(throwable instanceof CircuitBreakerOpenException) &&
               !(throwable instanceof SecurityException);
    }

    private static class CircuitBreaker {
        private final String name;
        private final AtomicInteger failureCount = new AtomicInteger(0);
        private final AtomicLong lastFailureTime = new AtomicLong(0);
        private final AtomicReference<CircuitBreakerState> state = new AtomicReference<>(CircuitBreakerState.CLOSED);

        public CircuitBreaker(String name) {
            this.name = name;
        }

        public void recordSuccess() {
            failureCount.set(0);
            state.set(CircuitBreakerState.CLOSED);
        }

        public void recordFailure() {
            int failures = failureCount.incrementAndGet();
            lastFailureTime.set(Instant.now().toEpochMilli());
            
            if (failures >= DEFAULT_FAILURE_THRESHOLD) {
                state.set(CircuitBreakerState.OPEN);
                log.warn("Circuit breaker {} opened after {} failures", name, failures);
            }
        }

        public boolean isOpen() {
            CircuitBreakerState currentState = state.get();
            
            if (currentState == CircuitBreakerState.CLOSED) {
                return false;
            }
            
            if (currentState == CircuitBreakerState.OPEN) {
                long timeSinceLastFailure = Instant.now().toEpochMilli() - lastFailureTime.get();
                if (timeSinceLastFailure > DEFAULT_TIMEOUT_DURATION.toMillis()) {
                    state.set(CircuitBreakerState.HALF_OPEN);
                    log.info("Circuit breaker {} moved to half-open state", name);
                    return false;
                }
                return true;
            }
            
            return false;
        }

        public CircuitBreakerState getState() {
            if (isOpen()) {
                return CircuitBreakerState.OPEN;
            }
            return state.get();
        }

        public void reset() {
            failureCount.set(0);
            lastFailureTime.set(0);
            state.set(CircuitBreakerState.CLOSED);
        }
    }

    public static class CircuitBreakerOpenException extends RuntimeException {
        public CircuitBreakerOpenException(String message) {
            super(message);
        }
    }
}