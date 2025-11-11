package com.ashelabs.turing.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * Redis configuration for quota management caching.
 * 
 * Provides reactive Redis templates optimized for quota data storage and retrieval
 * with proper serialization for complex objects like QuotaBalance.
 */
@Configuration
public class QuotaRedisConfig {
    
    @Value("${spring.redis.quota.host:localhost}")
    private String host;
    
    @Value("${spring.redis.quota.port:6379}")
    private int port;
    
    @Value("${spring.redis.quota.password:}")
    private String password;
    
    @Value("${spring.redis.quota.database:1}")
    private int database;
    
    /**
     * Reactive Redis connection factory for quota-specific Redis instance.
     * Uses a separate database to isolate quota data from other application data.
     */
    @Bean("quotaRedisConnectionFactory")
    @Primary
    public ReactiveRedisConnectionFactory quotaRedisConnectionFactory() {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration();
        config.setHostName(host);
        config.setPort(port);
        config.setDatabase(database);
        
        if (password != null && !password.trim().isEmpty()) {
            config.setPassword(password);
        }
        
        LettuceConnectionFactory factory = new LettuceConnectionFactory(config);
        factory.setValidateConnection(true);
        return factory;
    }
    
    /**
     * Reactive Redis template with JSON serialization for complex objects.
     * Optimized for storing quota-related data structures.
     */
    @Bean("quotaRedisTemplate")
    public ReactiveRedisTemplate<String, Object> quotaRedisTemplate(
            ReactiveRedisConnectionFactory quotaRedisConnectionFactory) {
        
        // JSON serializer for values with proper ObjectMapper configuration
        Jackson2JsonRedisSerializer<Object> jsonSerializer = new Jackson2JsonRedisSerializer<>(Object.class);
        
        // Configure ObjectMapper for proper serialization
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.findAndRegisterModules();
        
        // Use constructor-based configuration to avoid deprecated method
        jsonSerializer = new Jackson2JsonRedisSerializer<>(objectMapper, Object.class);
        
        // String serializer for keys
        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        
        // Build serialization context
        RedisSerializationContext<String, Object> serializationContext = 
            RedisSerializationContext.<String, Object>newSerializationContext()
                .key(stringSerializer)
                .value(jsonSerializer)
                .hashKey(stringSerializer)
                .hashValue(jsonSerializer)
                .build();
        
        return new ReactiveRedisTemplate<>(quotaRedisConnectionFactory, serializationContext);
    }
    
    /**
     * String-specific Redis template for simple key-value operations.
     * Useful for flags, counters, and simple string values.
     */
    @Bean("quotaStringRedisTemplate")
    public ReactiveRedisTemplate<String, String> quotaStringRedisTemplate(
            ReactiveRedisConnectionFactory quotaRedisConnectionFactory) {
        
        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        
        RedisSerializationContext<String, String> serializationContext = 
            RedisSerializationContext.<String, String>newSerializationContext()
                .key(stringSerializer)
                .value(stringSerializer)
                .hashKey(stringSerializer)
                .hashValue(stringSerializer)
                .build();
        
        return new ReactiveRedisTemplate<>(quotaRedisConnectionFactory, serializationContext);
    }
}