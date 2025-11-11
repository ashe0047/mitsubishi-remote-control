/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { Observable, throwError, from } from 'rxjs';
import { switchMap, catchError, timeout, tap } from 'rxjs/operators';
import { QuotaValidationService } from '../../quotas/services/quota-validation.service';
import { QuotaFeatureService } from '../../quotas/services/quota-feature.service';
import { QuotaValidationResult } from '../../quotas/interfaces/device-operation.interface';
import { ValidationStatus } from '../../quotas/interfaces/device-operation.interface';
import { DeviceOperation } from '../../quotas/interfaces/device-operation.interface';

// Minimal AC control service contract to avoid missing import issues
interface SimpleAirConService {
  setPower(roomId: string, power: boolean): Observable<void>;
  setTemperature(roomId: string, temperature: number): Observable<void>;
  setMode(roomId: string, mode: string): Observable<void>;
  setFanSpeed(roomId: string, fanSpeed: string): Observable<void>;
  getDeviceStatus(roomId: string): Observable<unknown>;
  getDeviceSettings(roomId: string): Observable<unknown>;
  getDeviceStateStream(roomId: string): Observable<unknown>;
}

// Enhanced DeviceOperation interface for quota validation
interface QuotaAwareDeviceOperation extends DeviceOperation {
  userId?: string;
  source?: string;
}

// (removed unused CommandType enum)

// Quota exceeded exception matching Spring Boot
class QuotaExceededException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededException';
  }
}

@Injectable()
export class QuotaAwareAirConService {
  private readonly logger = new Logger(QuotaAwareAirConService.name);

  constructor(
    private readonly airConService: SimpleAirConService,
    private readonly quotaValidationService: QuotaValidationService,
    private readonly quotaFeatureService: QuotaFeatureService,
  ) {}

  /**
   * Set power with quota validation (matching Spring Boot setPower with userId)
   */
  setPower(userId: string, roomId: string, power: boolean): Observable<void> {
    const command: QuotaAwareDeviceOperation = {
      userId,
      roomId,
      deviceId: roomId,
      operation: {
        type: power ? 'POWER_ON' : 'POWER_OFF',
        value: power,
        source: 'quota-aware-service',
      },
    };

    return this.validateAndExecute(command, () =>
      this.airConService.setPower(roomId, power),
    );
  }

  /**
   * Set power without user context (backward compatibility - matching Spring Boot setPower without userId)
   */
  setPowerWithoutValidation(roomId: string, power: boolean): Observable<void> {
    this.logger.debug(
      `Setting power for room ${roomId} without user context - skipping quota validation`,
    );
    return this.airConService.setPower(roomId, power);
  }

  /**
   * Set temperature with quota validation
   */
  setTemperature(
    userId: string,
    roomId: string,
    temperature: number,
  ): Observable<void> {
    const command: QuotaAwareDeviceOperation = {
      userId,
      roomId,
      deviceId: roomId,
      operation: {
        type: 'TEMPERATURE_SET',
        value: temperature,
        source: 'quota-aware-service',
      },
    };

    return this.validateAndExecute(command, () =>
      this.airConService.setTemperature(roomId, temperature),
    );
  }

  /**
   * Set temperature without user context (backward compatibility)
   */
  setTemperatureWithoutValidation(
    roomId: string,
    temperature: number,
  ): Observable<void> {
    this.logger.debug(
      `Setting temperature for room ${roomId} without user context - skipping quota validation`,
    );
    return this.airConService.setTemperature(roomId, temperature);
  }

  /**
   * Set mode with quota validation
   */
  setMode(userId: string, roomId: string, mode: string): Observable<void> {
    const command: QuotaAwareDeviceOperation = {
      userId,
      roomId,
      deviceId: roomId,
      operation: {
        type: 'MODE_SET',
        value: mode,
        source: 'quota-aware-service',
      },
    };

    return this.validateAndExecute(command, () =>
      this.airConService.setMode(roomId, mode),
    );
  }

  /**
   * Set mode without user context (backward compatibility)
   */
  setModeWithoutValidation(roomId: string, mode: string): Observable<void> {
    this.logger.debug(
      `Setting mode for room ${roomId} without user context - skipping quota validation`,
    );
    return this.airConService.setMode(roomId, mode);
  }

  /**
   * Set fan speed with quota validation
   */
  setFanSpeed(
    userId: string,
    roomId: string,
    fanSpeed: string,
  ): Observable<void> {
    const command: QuotaAwareDeviceOperation = {
      userId,
      roomId,
      deviceId: roomId,
      operation: {
        type: 'FAN_SET',
        value: fanSpeed,
        source: 'quota-aware-service',
      },
    };

    return this.validateAndExecute(command, () =>
      this.airConService.setFanSpeed(roomId, fanSpeed),
    );
  }

  /**
   * Set fan speed without user context (backward compatibility)
   */
  setFanSpeedWithoutValidation(
    roomId: string,
    fanSpeed: string,
  ): Observable<void> {
    this.logger.debug(
      `Setting fan speed for room ${roomId} without user context - skipping quota validation`,
    );
    return this.airConService.setFanSpeed(roomId, fanSpeed);
  }

  /**
   * Core validation and execution method (matching Spring Boot validateAndExecute pattern)
   */
  private validateAndExecute(
    command: QuotaAwareDeviceOperation,
    executionSupplier: () => Observable<void>,
  ): Observable<void> {
    const startTime = Date.now();
    const { userId, roomId } = command;

    // Step 1: Skip validation if no user context (matching Spring Boot logic)
    if (!userId) {
      return executionSupplier();
    }

    this.logger.debug(
      `Validating quota for user ${userId} in room ${roomId} for ${command.operation.type}`,
    );

    // Step 2: Check if quota feature is enabled for this user
    return from(this.quotaFeatureService.isQuotaEnabledForUser(userId)).pipe(
      switchMap((quotaEnabled) => {
        if (!quotaEnabled) {
          this.logger.debug(
            `Quota feature disabled for user ${userId} - executing command`,
          );
          return executionSupplier();
        }

        // Step 3: Perform quota validation
        return from(
          this.quotaValidationService.validateQuotaUsage(command),
        ).pipe(
          switchMap((validationResult) => {
            const status = validationResult.status;

            // Step 4a: Block if quota exceeded
            if (status === ValidationStatus.BLOCK) {
              const errorMessage = `Command blocked by quota: ${validationResult.reason}`;
              this.logger.warn(
                `Quota validation blocked for user ${userId} in room ${roomId}: ${errorMessage}`,
              );
              return throwError(() => new QuotaExceededException(errorMessage));
            }

            // Step 4b: Warn if approaching limit
            if (status === ValidationStatus.ALLOW_WITH_WARNING) {
              this.logger.log(
                `Command allowed with warning for user ${userId} in room ${roomId} - approaching quota limit: ${validationResult.reason}`,
              );
            }

            // Step 4c: Execute command if allowed
            return executionSupplier().pipe(
              tap(() => {
                const duration = Date.now() - startTime;
                this.logger.debug(
                  `Quota validation completed for user ${userId} room ${roomId} in ${duration}ms: ${status}`,
                );
              }),
            );
          }),
          // Step 5: Fail-safe error handling (matching Spring Boot pattern)
          catchError((error) => {
            if (error instanceof QuotaExceededException) {
              return throwError(() => error); // Don't execute if quota exceeded
            }

            // For validation service errors, log and continue (fail-safe)
            this.logger.error(
              `Quota validation error for user ${userId} room ${roomId} - executing command anyway (fail-safe): ${error.message}`,
              error,
            );
            return executionSupplier();
          }),
        );
      }),
      // Step 6: Feature service error handling (fail-safe)
      catchError((featureError) => {
        this.logger.error(
          `Error checking quota feature status for user ${userId} room ${roomId} - executing command anyway (fail-safe): ${featureError.message}`,
          featureError,
        );
        return executionSupplier();
      }),
      // Performance timeout protection (matching Spring Boot 100ms timeout)
      timeout(100),
      catchError((timeoutError) => {
        this.logger.warn(
          `Quota validation timeout for user ${userId} room ${roomId} - executing command (fail-safe)`,
        );
        return executionSupplier();
      }),
    );
  }

  /**
   * Check if a command requires quota validation (matching Spring Boot business logic)
   */
  private requiresQuotaValidation(operation: DeviceOperation): boolean {
    // Power OFF commands bypass quota (matching Spring Boot logic)
    if (operation.type === 'POWER_OFF') {
      return false;
    }

    // Read-only operations bypass quota
    if (operation.type === 'READ_ONLY') {
      return false;
    }

    // Emergency overrides bypass quota
    if (operation.hasEmergencyOverride) {
      return false;
    }

    // Business hours exemptions bypass quota
    if (operation.isBusinessHoursExempt) {
      return false;
    }

    // All other commands require validation
    return true;
  }

  /**
   * Build exceeded message for quota violations (matching Spring Boot pattern)
   */
  private buildExceededMessage(
    validationResult: QuotaValidationResult,
  ): string {
    let message = 'AC usage quota exceeded. ';

    if (validationResult.balance) {
      const balance = validationResult.balance;

      if (
        balance.remainingSeconds !== undefined &&
        balance.remainingSeconds <= 0
      ) {
        message += 'Time quota exhausted for today.';
      } else if (
        balance.remainingCount !== undefined &&
        balance.remainingCount <= 0
      ) {
        message += 'Usage count quota exhausted for today.';
      } else if (
        balance.remainingEnergy !== undefined &&
        balance.remainingEnergy <= 0
      ) {
        message += 'Energy quota exhausted for today.';
      } else if (
        balance.remainingCost !== undefined &&
        balance.remainingCost <= 0
      ) {
        message += 'Cost quota exceeded for today.';
      }
    }

    return message;
  }

  /**
   * Build warning message for approaching limits (matching Spring Boot pattern)
   */
  private buildWarningMessage(validationResult: QuotaValidationResult): string {
    let message = 'AC usage approaching daily limit. ';

    if (validationResult.balance) {
      const balance = validationResult.balance;

      if (balance.remainingSeconds && balance.remainingSeconds > 0) {
        const hours = Math.floor(balance.remainingSeconds / 3600);
        const minutes = Math.floor((balance.remainingSeconds % 3600) / 60);
        message += `${hours}h ${minutes}m remaining today.`;
      } else if (balance.remainingCount && balance.remainingCount > 0) {
        message += `${balance.remainingCount} uses remaining today.`;
      } else if (balance.remainingEnergy && balance.remainingEnergy > 0) {
        message += `${balance.remainingEnergy.toFixed(2)} kWh remaining today.`;
      } else if (balance.remainingCost && balance.remainingCost > 0) {
        message += `$${balance.remainingCost.toFixed(2)} remaining today.`;
      }
    }

    return message;
  }

  /**
   * Create quota validation request from device operation
   */
  private createValidationRequest(operation: QuotaAwareDeviceOperation): any {
    return {
      userId: operation.userId,
      roomId: operation.roomId,
      deviceId: operation.deviceId,
      operation: operation.operation,
    };
  }

  /**
   * Get device status without quota validation (read operations should bypass quota)
   */
  getDeviceStatus(roomId: string): Observable<any> {
    // Device status queries are read-only and bypass quota validation
    return this.airConService.getDeviceStatus(roomId);
  }

  /**
   * Get device settings without quota validation (read operations should bypass quota)
   */
  getDeviceSettings(roomId: string): Observable<any> {
    // Device settings queries are read-only and bypass quota validation
    return this.airConService.getDeviceSettings(roomId);
  }

  /**
   * Get device state stream without quota validation (monitoring bypasses quota)
   */
  getDeviceStateStream(roomId: string): Observable<any> {
    // State monitoring is read-only and bypasses quota validation
    return this.airConService.getDeviceStateStream(roomId);
  }
}
