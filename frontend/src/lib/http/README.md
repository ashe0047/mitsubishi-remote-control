# HTTP Client Infrastructure

A comprehensive HTTP client infrastructure built on top of axios with advanced interceptors for authentication, error handling, logging, and performance monitoring.

## Features

- **Centralized Configuration**: Single configuration point for all HTTP settings
- **Authentication Integration**: Automatic token injection and refresh
- **Error Handling**: Consistent error transformation and retry logic
- **Request/Response Logging**: Comprehensive logging with debug mode
- **Performance Monitoring**: Request deduplication, metrics collection, and cancellation
- **TypeScript Support**: Full type safety with enhanced interfaces
- **Interceptor Architecture**: Modular interceptor system for extensibility

## Quick Start

```typescript
import { axiosClient } from '@/lib/http';

// Basic usage
const data = await axiosClient.get<User[]>('/api/users');

// With custom configuration
const response = await axiosClient.post('/api/users', userData, {
  timeout: 10000,
  retries: 5,
});
```

## Configuration

### Default Configuration

```typescript
const DEFAULT_CONFIG: AxiosClientConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  enableLogging: process.env.NODE_ENV === 'development',
  enablePerformanceMonitoring: true,
  enableRequestDeduplication: true,
  maxConcurrentRequests: 10,
};
```

### Custom Configuration

```typescript
import { AxiosClient } from '@/lib/http';

const customClient = new AxiosClient({
  baseURL: 'https://api.example.com',
  timeout: 15000,
  retries: 5,
  enableLogging: true,
  maxConcurrentRequests: 20,
});
```

## Interceptors

### Authentication Interceptor

Automatically handles JWT token injection and refresh:

```typescript
// Tokens are automatically injected
const response = await axiosClient.get('/api/protected-resource');

// Token refresh happens automatically on 401 responses
// Failed requests are retried with new tokens
```

**Features:**
- Automatic Bearer token injection
- Token expiration detection and refresh
- Request queuing during token refresh
- Authentication failure handling with redirects

### Error Interceptor

Transforms axios errors into consistent ApiError format:

```typescript
try {
  await axiosClient.get('/api/data');
} catch (error) {
  if (isApiError(error)) {
    console.log(error.code);     // HTTP_404
    console.log(error.status);   // 404
    console.log(error.retryable); // false
    console.log(error.message);  // "The requested resource was not found."
  }
}
```

**Features:**
- Consistent error transformation
- Retry logic with exponential backoff
- Error classification (retryable vs non-retryable)
- User-friendly error messages

### Logging Interceptor

Comprehensive request/response logging:

```typescript
// Enable debug mode
axiosClient.getLoggingInterceptor().setDebugMode(true);

// Set log level
axiosClient.getLoggingInterceptor().setLogLevel('debug');
```

**Features:**
- Request/response logging with sanitization
- Performance timing metrics
- Debug mode with detailed information
- Configurable log levels
- Sensitive data redaction

### Performance Interceptor

Advanced performance monitoring and optimization:

```typescript
// Get performance metrics
const metrics = axiosClient.getPerformanceMetrics();
console.log(metrics.averageResponseTime);
console.log(metrics.cacheHitRate);

// Cancel requests
axiosClient.cancelRequest('request-id');
axiosClient.getPerformanceInterceptor().cancelAllRequests();
```

**Features:**
- Request deduplication for GET requests
- Concurrent request limiting
- Request cancellation support
- Performance metrics collection
- Memory usage monitoring

## API Reference

### AxiosClient Methods

```typescript
class AxiosClient {
  // HTTP methods
  get<T>(url: string, config?: ApiRequestConfig): Promise<T>
  post<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<T>
  put<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<T>
  patch<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<T>
  delete<T>(url: string, config?: ApiRequestConfig): Promise<T>

  // Utility methods
  cancelRequest(requestId: string): void
  getPerformanceMetrics(): RequestMetrics
  clearCache(): void
  updateConfig(newConfig: Partial<AxiosClientConfig>): void
  getInstance(): AxiosInstance

  // Interceptor access
  getAuthInterceptor(): AuthInterceptor
  getErrorInterceptor(): ErrorInterceptor
  getLoggingInterceptor(): LoggingInterceptor
  getPerformanceInterceptor(): PerformanceInterceptor
}
```

### Type Definitions

```typescript
interface ApiRequestConfig extends AxiosRequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  deduplicationKey?: string;
  priority?: 'low' | 'normal' | 'high';
}

interface ApiError extends Error {
  code: string;
  status: number;
  details?: any;
  timestamp: number;
  retryable: boolean;
  requestId?: string;
  context?: Record<string, any>;
}

interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  retryCount: number;
}
```

## Advanced Usage

### Custom Interceptor Configuration

```typescript
// Configure authentication
axiosClient.getAuthInterceptor().updateConfig({
  enableTokenRefresh: true,
  tokenRefreshThreshold: 300, // 5 minutes
  maxRetries: 3,
});

// Configure error handling
axiosClient.getErrorInterceptor().updateConfig({
  maxRetries: 5,
  retryDelay: 2000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
});

// Configure performance monitoring
axiosClient.getPerformanceInterceptor().updateConfig({
  enableRequestDeduplication: true,
  maxConcurrentRequests: 15,
  deduplicationTTL: 10000,
});
```

### Request Deduplication

```typescript
// These requests will be deduplicated (only one actual HTTP call)
const [users1, users2, users3] = await Promise.all([
  axiosClient.get('/api/users'),
  axiosClient.get('/api/users'),
  axiosClient.get('/api/users'),
]);
```

### Request Cancellation

```typescript
// Cancel specific request
const requestId = 'my-request-id';
axiosClient.cancelRequest(requestId);

// Cancel all active requests
const cancelledCount = axiosClient.getPerformanceInterceptor().cancelAllRequests('User navigation');
```

### Performance Monitoring

```typescript
// Get detailed metrics
const metrics = axiosClient.getPerformanceMetrics();
const performanceInterceptor = axiosClient.getPerformanceInterceptor();

console.log('Cache hit rate:', metrics.cacheHitRate);
console.log('Average response time:', metrics.averageResponseTime);
console.log('Active cancellations:', performanceInterceptor.getActiveCancellations());
console.log('Deduplication stats:', performanceInterceptor.getDeduplicationStats());
```

## Migration from Existing Clients

### From fetch-based clients

```typescript
// Before
const response = await fetch('/api/users', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const users = await response.json();

// After
const users = await axiosClient.get<User[]>('/api/users');
// Authentication is handled automatically
```

### From basic axios

```typescript
// Before
import axios from 'axios';
const response = await axios.get('/api/users');

// After
import { axiosClient } from '@/lib/http';
const users = await axiosClient.get<User[]>('/api/users');
// Enhanced error handling, logging, and performance monitoring included
```

## Testing

The HTTP client infrastructure includes comprehensive test utilities:

```typescript
import { AxiosClient } from '@/lib/http';

// Create test client
const testClient = new AxiosClient({
  baseURL: 'http://localhost:3001',
  enableLogging: false,
});

// Mock interceptors for testing
vi.mock('@/lib/http', () => ({
  axiosClient: mockAxiosClient,
}));
```

## Environment Variables

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

# Development settings
NODE_ENV=development  # Enables logging by default
```

## Best Practices

1. **Use the singleton instance** (`axiosClient`) for most use cases
2. **Handle errors consistently** using the `isApiError` type guard
3. **Configure interceptors** based on your application needs
4. **Monitor performance metrics** in production
5. **Use request deduplication** for expensive GET requests
6. **Implement proper cleanup** when cancelling requests
7. **Test with mocked interceptors** for unit tests

## Troubleshooting

### Common Issues

1. **Token refresh loops**: Check token expiration logic
2. **Request deduplication issues**: Verify deduplication keys
3. **Performance degradation**: Monitor concurrent request limits
4. **Memory leaks**: Ensure proper cleanup of cancelled requests

### Debug Mode

Enable debug mode for detailed logging:

```typescript
axiosClient.getLoggingInterceptor().setDebugMode(true);
axiosClient.getLoggingInterceptor().setLogLevel('debug');
```

### Performance Analysis

```typescript
// Get performance insights
const metrics = axiosClient.getPerformanceMetrics();
const loggingMetrics = axiosClient.getLoggingInterceptor().getPerformanceMetrics();

console.log('Slow requests:', loggingMetrics.slowRequests);
console.log('Memory usage:', metrics.memoryUsage);
console.log('Bundle size impact:', metrics.bundleSize);
```