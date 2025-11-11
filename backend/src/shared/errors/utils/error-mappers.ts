import type { WsErrorResponse } from '../../websocket-gateway/interfaces/websocket-messages.interface';
import type { HttpErrorResponse } from '../types/error.types';

/**
 * Build a WsErrorResponse in a single place to keep formatting consistent.
 */
export function toWsErrorResponse(options: {
  message: string;
  commandId: string;
  errorCode?: string;
  category?: 'validation' | 'authorization' | 'execution' | 'infrastructure';
  retryable?: boolean;
  processingTimeMs?: number;
  metadata?: WsErrorResponse['metadata'];
  deviceId?: string;
}): WsErrorResponse {
  const {
    message,
    commandId,
    errorCode = 'INTERNAL_SERVER_ERROR',
    category = 'execution',
    retryable = false,
    processingTimeMs = 0,
    metadata,
    deviceId,
  } = options;

  return {
    success: false,
    error: message,
    errorCode,
    errorCategory: category,
    retryable,
    processingTime: processingTimeMs,
    deviceId,
    commandId,
    timestamp: new Date(),
    metadata: metadata ?? { strategy: 'shared', gatewayType: 'device' },
  };
}

/**
 * Build an HttpErrorEnvelope compatible with the standard formatter output.
 */
export function toHttpErrorResponse(options: {
  statusCode: number;
  message: string;
  error?: string;
  timestamp?: string;
  path?: string;
  requestId?: string;
  details?: Record<string, unknown>;
  businessCode?: string;
}): HttpErrorResponse {
  const {
    statusCode,
    message,
    error = 'INTERNAL_SERVER_ERROR',
    timestamp = new Date().toISOString(),
    path,
    requestId,
    details,
    businessCode,
  } = options;

  return {
    success: false,
    error: {
      statusCode,
      message,
      error,
      timestamp,
      path,
      requestId,
      details,
      businessCode,
    },
  };
}
