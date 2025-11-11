# Deployment Guide

## Overview

This document provides comprehensive deployment instructions for the NestJS backend, including development, staging, and production environments. The guide ensures smooth deployment while maintaining security and performance requirements.

## Environment Configuration

### Development Environment

```bash
# .env.development
NODE_ENV=development
PORT=8080

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/mitsubishi_controller_dev
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=mitsubishi_controller_dev

# JWT Configuration
JWT_SECRET=development-jwt-secret-key-change-in-production
JWT_REFRESH_SECRET=development-refresh-secret-key-change-in-production
JWT_EXPIRATION=24h
JWT_REFRESH_EXPIRATION=7d

# MQTT Configuration
MQTT_BROKER_URL=localhost
MQTT_BROKER_PORT=1883
MQTT_USERNAME=mitsubishi_user
MQTT_PASSWORD=mitsubishi_password
MQTT_BASE_TOPIC=mitsubishi2mqtt

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=debug
LOG_FORMAT=dev

# Performance
CACHE_DEFAULT_TTL=3600
QUOTA_VALIDATION_TIMEOUT=100

# Security
BCRYPT_ROUNDS=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Production Environment

```bash
# .env.production
NODE_ENV=production
PORT=8080

# Database Configuration (use secrets management in production)
DATABASE_URL=${DATABASE_URL}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=mitsubishi_controller

# JWT Configuration (use strong secrets from secret manager)
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRATION=24h
JWT_REFRESH_EXPIRATION=7d

# MQTT Configuration
MQTT_BROKER_URL=${MQTT_BROKER_URL}
MQTT_BROKER_PORT=${MQTT_BROKER_PORT}
MQTT_USERNAME=${MQTT_USERNAME}
MQTT_PASSWORD=${MQTT_PASSWORD}
MQTT_BASE_TOPIC=mitsubishi2mqtt

# Redis Configuration
REDIS_URL=redis://${REDIS_HOST}:${REDIS_PORT}
REDIS_HOST=${REDIS_HOST}
REDIS_PORT=${REDIS_PORT}
REDIS_PASSWORD=${REDIS_PASSWORD}

# CORS Configuration
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Performance
CACHE_DEFAULT_TTL=3600
QUOTA_VALIDATION_TIMEOUT=80

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Health Checks
HEALTH_CHECK_INTERVAL=30000
```

## Docker Configuration

### Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN corepack enable pnpm && pnpm run build

# Production image, copy all the files and run nest
FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Set permissions
USER nestjs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "dist/main"]
```

### Docker Compose (Development)

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # NestJS Backend
  backend:
    build:
      context: ./backend-2
      dockerfile: Dockerfile
      target: base
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/mitsubishi_controller_dev
      - REDIS_URL=redis://redis:6379
      - MQTT_BROKER_URL=mosquitto
    volumes:
      - ./backend-2/src:/app/src
      - ./backend-2/package.json:/app/package.json
      - ./backend-2/tsconfig.json:/app/tsconfig.json
    depends_on:
      - postgres
      - redis
      - mosquitto
    command: pnpm run start:dev
    networks:
      - mitsubishi-network

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=mitsubishi_controller_dev
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - mitsubishi-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    networks:
      - mitsubishi-network

  # MQTT Broker
  mosquitto:
    image: eclipse-mosquitto:2.0
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf
      - ./mosquitto/passwd:/mosquitto/config/passwd
      - mosquitto_data:/mosquitto/data
      - mosquitto_logs:/mosquitto/log
    networks:
      - mitsubishi-network

  # Frontend (for development)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_MQTT_BROKER_URL=ws://localhost:9001
      - NEXT_PUBLIC_API_URL=http://localhost:8080
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
    depends_on:
      - backend
    networks:
      - mitsubishi-network

volumes:
  postgres_data:
  redis_data:
  mosquitto_data:
  mosquitto_logs:

networks:
  mitsubishi-network:
    driver: bridge
```

### Docker Compose (Production)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # NestJS Backend
  backend:
    build:
      context: ./backend-2
      dockerfile: Dockerfile
      target: runner
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - mitsubishi-network
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USERNAME}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    env_file:
      - .env.production
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init-prod.sql:/docker-entrypoint-initdb.d/init.sql
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    networks:
      - mitsubishi-network
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME} -d ${DB_NAME}"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    env_file:
      - .env.production
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
    networks:
      - mitsubishi-network
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "2"
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # MQTT Broker
  mosquitto:
    image: eclipse-mosquitto:2.0
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto/mosquitto.prod.conf:/mosquitto/config/mosquitto.conf
      - ./mosquitto/passwd.prod:/mosquitto/config/passwd
      - mosquitto_data:/mosquitto/data
      - mosquitto_logs:/mosquitto/log
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 128M
        reservations:
          cpus: '0.25'
          memory: 64M
    networks:
      - mitsubishi-network
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "2"

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
    networks:
      - mitsubishi-network
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "2"

volumes:
  postgres_data:
  redis_data:
  mosquitto_data:
  mosquitto_logs:

networks:
  mitsubishi-network:
    driver: bridge
```

## Nginx Configuration

### Nginx Reverse Proxy

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

    # Upstream backend servers
    upstream backend {
        least_conn;
        server backend:8080 max_fails=3 fail_timeout=30s;
        # Add more servers for load balancing
        # server backend2:8080 max_fails=3 fail_timeout=30s;
    }

    # HTTP redirect to HTTPS
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Referrer-Policy "strict-origin-when-cross-origin";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Authentication endpoints with stricter rate limiting
        location /api/auth/ {
            limit_req zone=auth burst=10 nodelay;

            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # WebSocket endpoints
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket specific
            proxy_cache_bypass $http_upgrade;
            proxy_buffering off;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://backend;
            access_log off;
        }

        # Static files (if serving frontend)
        location / {
            root /var/www/html;
            index index.html index.htm;
            try_files $uri $uri/ /index.html;
        }
    }
}
```

## Deployment Scripts

### Deployment Script

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

# Configuration
ENVIRONMENT=${1:-development}
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 Starting deployment for environment: $ENVIRONMENT"

# Create backup directory
mkdir -p $BACKUP_DIR

# Load environment variables
if [ "$ENVIRONMENT" = "production" ]; then
    if [ ! -f .env.production ]; then
        echo "❌ .env.production file not found"
        exit 1
    fi
    export $(cat .env.production | grep -v '^#' | xargs)
else
    if [ ! -f .env.development ]; then
        echo "❌ .env.development file not found"
        exit 1
    fi
    export $(cat .env.development | grep -v '^#' | xargs)
fi

# Function to check service health
check_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=30
    local attempt=1

    echo "⏳ Checking $service_name health..."

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            echo "✅ $service_name is healthy"
            return 0
        fi

        echo "⏳ Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 10
        ((attempt++))
    done

    echo "❌ $service_name failed health check"
    return 1
}

# Database backup (production only)
if [ "$ENVIRONMENT" = "production" ]; then
    echo "💾 Creating database backup..."
    pg_dump -h $DB_HOST -U $DB_USERNAME -d $DB_NAME > "$BACKUP_DIR/migration_backup_$TIMESTAMP.sql"
    gzip "$BACKUP_DIR/migration_backup_$TIMESTAMP.sql"
    echo "✅ Database backup created: ${BACKUP_DIR}/migration_backup_${TIMESTAMP}.sql.gz"
fi

# Stop existing services
echo "🛑 Stopping existing services..."
docker-compose -f docker-compose.$ENVIRONMENT.yml down

# Pull latest images
echo "📦 Pulling latest images..."
docker-compose -f docker-compose.$ENVIRONMENT.yml pull

# Build and start services
echo "🔨 Building and starting services..."
if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose -f docker-compose.prod.yml up --build -d
else
    docker-compose -f docker-compose.dev.yml up --build -d
fi

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Run database migrations if needed
echo "🗄️ Running database migrations..."
docker-compose -f docker-compose.$ENVIRONMENT.yml exec backend pnpm run migration:run

# Health checks
echo "🏥 Performing health checks..."

# Check backend health
check_health "Backend" "http://localhost:8080/health"

# Check database health
check_health "Database" "http://localhost:8080/health/database"

# Check Redis health
check_health "Redis" "http://localhost:8080/health/redis"

# Run smoke tests
echo "🧪 Running smoke tests..."
npm run test:smoke || {
    echo "❌ Smoke tests failed"
    # Rollback on failure
    echo "🔄 Rolling back deployment..."
    docker-compose -f docker-compose.$ENVIRONMENT.yml down

    if [ "$ENVIRONMENT" = "production" ] && [ -f "$BACKUP_DIR/migration_backup_$TIMESTAMP.sql.gz" ]; then
        echo "🔄 Restoring database from backup..."
        gunzip -c "$BACKUP_DIR/migration_backup_$TIMESTAMP.sql.gz" | psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME
    fi

    exit 1
}

echo "✅ Deployment completed successfully!"
echo "📊 Service status:"
docker-compose -f docker-compose.$ENVIRONMENT.yml ps

# Clean up old backups (keep last 10)
echo "🧹 Cleaning up old backups..."
ls -t $BACKUP_DIR/migration_backup_*.sql.gz | tail -n +11 | xargs -r rm

echo "🎉 Deployment to $ENVIRONMENT completed successfully!"
```

### Rollback Script

```bash
#!/bin/bash
# scripts/rollback.sh

set -e

ENVIRONMENT=${1:-production}
BACKUP_FILE=$2

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Backup file not specified"
    echo "Usage: $0 <environment> <backup_file>"
    exit 1
fi

echo "🔄 Starting rollback to environment: $ENVIRONMENT"
echo "📁 Using backup file: $BACKUP_FILE"

# Load environment variables
if [ "$ENVIRONMENT" = "production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    export $(cat .env.development | grep -v '^#' | xargs)
fi

# Stop current services
echo "🛑 Stopping current services..."
docker-compose -f docker-compose.$ENVIRONMENT.yml down

# Restore database
echo "🗄️ Restoring database from backup..."
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME
else
    psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME < "$BACKUP_FILE"
fi

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.$ENVIRONMENT.yml up -d

# Health checks
echo "🏥 Checking service health..."
sleep 30

curl -f http://localhost:8080/health || {
    echo "❌ Service health check failed after rollback"
    exit 1
}

echo "✅ Rollback completed successfully!"
```

## Monitoring and Logging

### Health Check Endpoints

```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthCheckResult } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { MqttHealthIndicator } from './indicators/mqtt.health';
import { PerformanceHealthIndicator } from './indicators/performance.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly databaseHealth: DatabaseHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly mqttHealth: MqttHealthIndicator,
    private readonly performanceHealth: PerformanceHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return await this.healthCheckService.check([
      this.databaseHealth,
      this.redisHealth,
      this.mqttHealth,
      this.performanceHealth,
    ]);
  }

  @Get('database')
  @HealthCheck()
  async checkDatabase(): Promise<HealthCheckResult> {
    return await this.healthCheckService.check([this.databaseHealth]);
  }

  @Get('redis')
  @HealthCheck()
  async checkRedis(): Promise<HealthCheckResult> {
    return await this.healthCheckService.check([this.redisHealth]);
  }

  @Get('mqtt')
  @HealthCheck()
  async checkMqtt(): Promise<HealthCheckResult> {
    return await this.healthCheckService.check([this.mqttHealth]);
  }

  @Get('performance')
  @HealthCheck()
  async checkPerformance(): Promise<HealthCheckResult> {
    return await this.healthCheckService.check([this.performanceHealth]);
  }

  @Get('ready')
  async readiness(): Promise<{ status: string; timestamp: string }> {
    // Simple readiness check
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  async liveness(): Promise<{ status: string; timestamp: string }> {
    // Simple liveness check
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }
}
```

### Structured Logging

```typescript
// src/logging/logging.service.ts
import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggingService implements LoggerService {
  private readonly context: string;
  private readonly isProduction: boolean;

  constructor(context: string, private readonly configService: ConfigService) {
    this.context = context;
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
  }

  log(message: any, context?: string) {
    this.writeLog('info', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.writeLog('error', message, context, trace);
  }

  warn(message: any, context?: string) {
    this.writeLog('warn', message, context);
  }

  debug(message: any, context?: string) {
    if (!this.isProduction) {
      this.writeLog('debug', message, context);
    }
  }

  verbose(message: any, context?: string) {
    if (!this.isProduction) {
      this.writeLog('verbose', message, context);
    }
  }

  private writeLog(level: LogLevel, message: any, context?: string, trace?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      context: context || this.context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      trace,
      service: 'mitsubishi-backend',
      version: process.env.APP_VERSION || '1.0.0',
    };

    if (this.isProduction) {
      // JSON format for production logging
      console.log(JSON.stringify(logEntry));
    } else {
      // Human-readable format for development
      const formattedMessage = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.context}] ${logEntry.message}`;

      switch (level) {
        case 'error':
          console.error(formattedMessage, trace || '');
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'debug':
        case 'verbose':
          console.debug(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }
  }
}
```

This comprehensive deployment guide ensures smooth and reliable deployment of the NestJS backend across different environments while maintaining security, performance, and monitoring requirements.