# Quota System Development and Testing Guide

## Overview

This document provides guidance for developing and testing the quota management system during the development phase. The quota system adds usage tracking and enforcement capabilities to the AC control system while maintaining all existing functionality.

## Development Setup

### Prerequisites
- ✅ Spring Boot 3.5.5 application
- ✅ PostgreSQL database (local development)
- ✅ Redis cache (local development)
- ✅ MQTT broker for AC control integration
- ✅ Frontend application running

### Quick Start

1. **Start required services:**
```bash
# Start PostgreSQL (if using Docker)
docker run --name postgres-dev -p 5432:5432 -e POSTGRES_DB=turing -e POSTGRES_PASSWORD=password -d postgres:15

# Start Redis (if using Docker)
docker run --name redis-dev -p 6379:6379 -d redis:7

# Start MQTT broker (if needed)
docker run --name mqtt-dev -p 1883:1883 -d eclipse-mosquitto
```

2. **Configure environment:**
```bash
# Backend configuration
export QUOTA_FEATURE_ENABLED=true
export QUOTA_DB_URL=r2dbc:postgresql://localhost:5432/turing
export QUOTA_DB_USERNAME=postgres
export QUOTA_DB_PASSWORD=password
```

3. **Run the application:**
```bash
cd backend/turing
./mvnw spring-boot:run -Dspring.profiles.active=dev
```

## Development Configuration

The application uses `application-dev.properties` for development settings:

### Key Development Settings
- **Quota Feature**: Enabled by default (`quota.feature.enabled=true`)
- **Validation Timeout**: 200ms (relaxed for development)
- **Cache TTL**: Shorter durations for testing (5 minutes)
- **Circuit Breaker**: Lower thresholds for easier testing
- **Logging**: DEBUG level for quota services
- **Error Display**: Full stack traces for debugging

### Database Configuration
- **Host**: `localhost:5432`
- **Database**: `turing`
- **Pool Size**: Smaller for development (5-20 connections)

### Redis Configuration
- **Host**: `localhost:6379`
- **Timeout**: 200ms (more lenient)
- **Pool Size**: Smaller for development (5-10 connections)

## Testing the Quota System

### Automated Testing

Run the integration test suite:
```bash
cd backend/turing
./mvnw test -Dtest=QuotaSystemIntegrationTest
```

**Test Coverage:**
1. ✅ End-to-end quota workflow
2. ✅ Failover and fail-safe behavior
3. ✅ Performance validation (relaxed thresholds)
4. ✅ Concurrent quota validation
5. ✅ Quota exceeded scenarios
6. ✅ Warning threshold behavior
7. ✅ System health checks
8. ✅ Data consistency validation

### Manual Testing

Use the development testing script:
```bash
./scripts/manual-quota-testing.sh
```

**Manual Test Categories:**
1. **Feature Flag Safety** - Quota disable/enable
2. **Quota Configuration** - Creating and managing quotas
3. **WebSocket Notifications** - Real-time updates
4. **Parent Override** - Override expired quotas
5. **Error Handling** - Fail-safe behavior
6. **Performance** - Basic load testing

### API Testing

Test quota endpoints directly:

**Check quota feature status:**
```bash
curl http://localhost:8080/admin/quota/status
```

**Create a test quota:**
```bash
curl -X POST http://localhost:8080/api/quotas \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-001",
    "targetId": "room_001",
    "targetType": "ROOM",
    "quotaType": "TIME_BASED",
    "allowedAmount": 240,
    "effectiveFrom": "2024-01-01",
    "effectiveUntil": "2024-12-31",
    "warningThresholds": [75, 90]
  }'
```

**Test AC command with quota validation:**
```bash
curl -X POST http://localhost:8080/api/rooms/room_001/power \
  -H "Content-Type: application/json" \
  -d '{"power": true, "userId": "test-user-001"}'
```

## Development Features

### Health Checks

Access health information at:
- **General Health**: `http://localhost:8080/actuator/health`
- **Quota Health**: `http://localhost:8080/actuator/health/quota`
- **Detailed Info**: `http://localhost:8080/actuator/info`

### Metrics

View quota metrics at:
- **All Metrics**: `http://localhost:8080/actuator/metrics`
- **Quota Validation**: `http://localhost:8080/actuator/metrics/quota.validation.duration`
- **Error Rates**: `http://localhost:8080/actuator/metrics/quota.validation.errors`

### Development Tools

**WebSocket Testing:**
Connect to WebSocket endpoint for real-time quota notifications:
- **URL**: `ws://localhost:8080/ws`
- **Authentication**: JWT token required
- **Messages**: JSON-formatted quota events

**Database Access:**
```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d turing

# View quota tables
\dt quota*
SELECT * FROM quotas;
SELECT * FROM usage_sessions;
```

**Redis Access:**
```bash
# Connect to Redis
redis-cli

# View quota cache
KEYS quota:*
GET quota:balance:user123:room001
```

## Debugging Guide

### Common Issues

**Quota not being enforced:**
1. Check feature flag: `quota.feature.enabled=true`
2. Verify user ID is provided in AC commands
3. Check quota exists for user/room combination
4. Review logs for validation errors

**Performance issues:**
1. Check database connection pool
2. Verify Redis connectivity
3. Review cache hit ratios
4. Check circuit breaker status

**WebSocket notifications not working:**
1. Verify WebSocket connection
2. Check JWT authentication
3. Review event publishing logs
4. Validate household membership

### Log Analysis

**Key log patterns to look for:**
```bash
# Quota validation performance
grep "Quota validation completed" logs/application.log

# Circuit breaker events
grep "Circuit breaker" logs/application.log

# Usage session tracking
grep "Session started\|Session ended" logs/application.log

# Error patterns
grep -E "QuotaValidationException|QuotaExceededException" logs/application.log
```

### Debug Configuration

Enable additional debugging by setting these properties:
```properties
logging.level.com.ashelabs.turing.service.QuotaValidationService=TRACE
logging.level.com.ashelabs.turing.service.ReactiveAirConService=DEBUG
logging.level.org.springframework.data.r2dbc=DEBUG
quota.performance.enable-query-logging=true
```

## Development Workflow

### Feature Development

1. **Start with tests** - Write integration tests first
2. **Use feature flags** - Keep quota feature toggleable
3. **Fail-safe design** - AC functionality must always work
4. **Monitor performance** - Keep validation under 200ms
5. **Test error scenarios** - Verify graceful degradation

### Code Review Checklist

- [ ] AC functionality preserved when quota disabled
- [ ] Proper error handling with fail-safe behavior
- [ ] Performance targets met (< 200ms validation)
- [ ] Integration tests added for new features
- [ ] Database migrations included if needed
- [ ] WebSocket events published for UI updates
- [ ] Cache invalidation handled correctly
- [ ] Logging added for debugging

### Testing Scenarios

**Happy Path:**
1. User with quota turns on AC ✅
2. Usage tracked correctly ✅
3. Quota balance updated ✅
4. WebSocket notification sent ✅

**Error Scenarios:**
1. Database unavailable → AC still works ✅
2. Redis unavailable → AC still works ✅
3. Quota service timeout → AC still works ✅
4. Invalid user ID → AC still works ✅

**Edge Cases:**
1. Quota exactly at limit → Warning shown
2. Quota exceeded → Command blocked
3. Parent override → Command allowed
4. Concurrent commands → Consistent behavior

## Next Steps

### When Ready for Production

1. **Performance testing** with realistic load
2. **Security review** of quota endpoints
3. **Monitoring setup** with alerts and dashboards
4. **Documentation update** for operations team
5. **Training** for support staff
6. **Rollout plan** with gradual feature enablement

### Future Enhancements

- **Energy-based quotas** for cost control
- **Usage analytics** and reporting
- **Mobile app integration** for parent controls
- **Automated override requests** with approval workflow
- **Machine learning** for usage pattern analysis

---

**Document Version:** 1.0
**Last Updated:** $(date)
**Environment:** Development

This guide should be updated as the quota system evolves during development.