import { z } from 'zod';

// Environment configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

// Validation result schema matching backend QuotaValidationResult
export const quotaValidationResultSchema = z.object({
  status: z.enum(['ALLOW', 'ALLOW_WITH_WARNING', 'BLOCK', 'FAIL_OPEN']),
  message: z.string(),
  reason: z.string(),
  quotaUsage: z.object({
    currentUsage: z.number().optional(),
    dailyLimit: z.number().optional(),
    remainingUsage: z.number().optional(),
    usagePercentage: z.number().optional()
  }).optional(),
  validationDurationMs: z.number().optional(),
  timestamp: z.number().optional()
});

export type QuotaValidationResult = z.infer<typeof quotaValidationResultSchema>;

// Command request schemas
export const validateCommandRequestSchema = z.object({
  roomId: z.string(),
  action: z.string(),
  targetTemperature: z.number().optional(),
  mode: z.string().optional(),
  fanSpeed: z.string().optional(),
  estimatedDurationMinutes: z.number().optional()
});

export const executeCommandRequestSchema = z.object({
  roomId: z.string(),
  action: z.string(),
  targetTemperature: z.number().optional(),
  mode: z.string().optional(),
  fanSpeed: z.string().optional(),
  vanePosition: z.string().optional(),
  wideVanePosition: z.string().optional(),
  estimatedDurationMinutes: z.number().optional()
});

export const startSessionRequestSchema = z.object({
  roomId: z.string(),
  initialSettings: z.record(z.any())
});

export const endSessionRequestSchema = z.object({
  roomId: z.string(),
  finalSettings: z.record(z.any()).optional()
});

export type ValidateCommandRequest = z.infer<typeof validateCommandRequestSchema>;
export type ExecuteCommandRequest = z.infer<typeof executeCommandRequestSchema>;
export type StartSessionRequest = z.infer<typeof startSessionRequestSchema>;
export type EndSessionRequest = z.infer<typeof endSessionRequestSchema>;

// Response schemas
export const commandResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  command: z.string().optional(),
  validationStatus: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  validationResult: quotaValidationResultSchema.optional()
});

export const sessionResponseSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string(),
  userId: z.string().optional(),
  roomId: z.string(),
  error: z.string().optional()
});

export const statusResponseSchema = z.object({
  roomId: z.string(),
  status: z.string(),
  state: z.record(z.any()),
  settings: z.record(z.any()),
  mqttConnected: z.boolean(),
  lastUpdate: z.string(),
  message: z.string()
});

export type CommandResponse = z.infer<typeof commandResponseSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;

// Custom error classes
export class QuotaApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public validationResult?: QuotaValidationResult
  ) {
    super(message);
    this.name = 'QuotaApiError';
  }
}

export class QuotaExceededError extends QuotaApiError {
  constructor(message: string, validationResult?: QuotaValidationResult) {
    super(message, 403, 'QUOTA_EXCEEDED', validationResult);
    this.name = 'QuotaExceededError';
  }
}

/**
 * HTTP client for communicating with the quota-aware backend API.
 *
 * This client provides methods for validating and executing AC commands
 * with integrated quota management.
 */
export class QuotaApiClient {
  private baseUrl: string;
  private getAuthToken: () => Promise<string | null>;

  constructor(options: {
    baseUrl?: string;
    getAuthToken: () => Promise<string | null>;
  }) {
    this.baseUrl = options.baseUrl || API_BASE_URL;
    this.getAuthToken = options.getAuthToken;
  }

  /**
   * Makes an authenticated HTTP request to the API.
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    responseSchema?: z.ZodSchema<T>
  ): Promise<T> {
    const authToken = await this.getAuthToken();

    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    console.log(`🌐 Making request to ${url}`, {
      method: options.method || 'GET',
      hasAuth: !!authToken,
      body: options.body ? JSON.parse(options.body as string) : undefined
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const responseText = await response.text();
      let responseData: any;

      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new QuotaApiError(`Invalid JSON response: ${responseText}`);
      }

      console.log(`📥 Response from ${url}:`, {
        status: response.status,
        ok: response.ok,
        data: responseData
      });

      if (!response.ok) {
        // Handle quota exceeded errors specifically
        if (response.status === 403 && responseData.code === 'QUOTA_EXCEEDED') {
          throw new QuotaExceededError(
            responseData.error || 'Quota exceeded',
            responseData.validationResult
          );
        }

        throw new QuotaApiError(
          responseData.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          responseData.code
        );
      }

      // Validate response if schema provided
      if (responseSchema) {
        try {
          return responseSchema.parse(responseData);
        } catch (validationError) {
          console.error('Response validation error:', validationError);
          console.error('Invalid response data:', responseData);
          // Return the raw data if validation fails to avoid breaking the app
          return responseData as T;
        }
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof QuotaApiError) {
        throw error;
      }

      console.error(`❌ Request failed for ${url}:`, error);
      throw new QuotaApiError(
        error instanceof Error ? error.message : 'Network request failed'
      );
    }
  }

  /**
   * Validates an AC command against quota limits without executing it.
   */
  async validateCommand(request: ValidateCommandRequest): Promise<QuotaValidationResult> {
    console.log('🔍 Validating AC command:', request);

    const validatedRequest = validateCommandRequestSchema.parse(request);

    return this.makeRequest(
      '/api/aircon/validate',
      {
        method: 'POST',
        body: JSON.stringify(validatedRequest)
      },
      quotaValidationResultSchema
    );
  }

  /**
   * Executes an AC command with quota validation.
   */
  async executeCommand(request: ExecuteCommandRequest): Promise<CommandResponse> {
    console.log('⚡ Executing AC command:', request);

    const validatedRequest = executeCommandRequestSchema.parse(request);

    return this.makeRequest(
      '/api/aircon/command',
      {
        method: 'POST',
        body: JSON.stringify(validatedRequest)
      },
      commandResponseSchema
    );
  }

  /**
   * Starts a usage session when AC is turned on.
   */
  async startUsageSession(request: StartSessionRequest): Promise<SessionResponse> {
    console.log('▶️ Starting usage session:', request);

    const validatedRequest = startSessionRequestSchema.parse(request);

    return this.makeRequest(
      '/api/aircon/session/start',
      {
        method: 'POST',
        body: JSON.stringify(validatedRequest)
      },
      sessionResponseSchema
    );
  }

  /**
   * Ends a usage session when AC is turned off.
   */
  async endUsageSession(sessionId: string, request: EndSessionRequest): Promise<SessionResponse> {
    console.log('⏹️ Ending usage session:', { sessionId, ...request });

    const validatedRequest = endSessionRequestSchema.parse(request);

    return this.makeRequest(
      `/api/aircon/session/${sessionId}/end`,
      {
        method: 'POST',
        body: JSON.stringify(validatedRequest)
      },
      sessionResponseSchema
    );
  }

  /**
   * Gets current AC status for a room.
   */
  async getRoomStatus(roomId: string): Promise<StatusResponse> {
    console.log('📊 Getting room status:', roomId);

    return this.makeRequest(
      `/api/aircon/status/${roomId}`,
      { method: 'GET' },
      statusResponseSchema
    );
  }

  /**
   * Convenience method to handle AC commands with automatic quota validation.
   *
   * This method follows the pattern:
   * 1. Validate command against quotas
   * 2. If allowed, execute the command
   * 3. Return both validation and execution results
   */
  async validateAndExecuteCommand(
    request: ExecuteCommandRequest,
    options: {
      skipValidation?: boolean;
      onValidationResult?: (result: QuotaValidationResult) => void;
      onQuotaExceeded?: (error: QuotaExceededError) => void;
    } = {}
  ): Promise<{
    validationResult?: QuotaValidationResult;
    executionResult: CommandResponse;
  }> {
    console.log('🔄 Validate and execute AC command:', request);

    let validationResult: QuotaValidationResult | undefined;

    // Step 1: Validate if not skipping
    if (!options.skipValidation) {
      try {
        validationResult = await this.validateCommand(request);
        options.onValidationResult?.(validationResult);

        // Check if command should be blocked
        if (validationResult.status === 'BLOCK') {
          const error = new QuotaExceededError(
            validationResult.message || 'Command blocked by quota',
            validationResult
          );
          options.onQuotaExceeded?.(error);
          throw error;
        }
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          options.onQuotaExceeded?.(error);
          throw error;
        }
        // For validation errors, log and continue (fail-safe)
        console.warn('Quota validation failed, proceeding anyway (fail-safe):', error);
      }
    }

    // Step 2: Execute the command
    const executionResult = await this.executeCommand(request);

    return {
      validationResult,
      executionResult
    };
  }
}