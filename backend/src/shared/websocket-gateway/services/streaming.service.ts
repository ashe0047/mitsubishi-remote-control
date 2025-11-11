import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, merge, fromEvent, timer, from } from 'rxjs';
import {
  bufferTime,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
  retryWhen,
  share,
  shareReplay,
  takeUntil,
} from 'rxjs/operators';
import type { Socket } from 'socket.io';
import type { ZodType, z } from 'zod';
import { validateWithZod } from '../../../common/rx/zod-operators';
import { mqttMessageSchema } from '../../mqtt/schemas/mqtt.schema';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly destroy$ = new Subject<void>();

  // Generic buffered stream with simple backpressure
  createBufferedStream<T>(
    source$: Observable<T>,
    options: {
      maxPerWindow?: number;
      windowMs?: number;
      debounceMs?: number;
    } = {},
  ): Observable<T> {
    const { maxPerWindow = 50, windowMs = 100, debounceMs = 0 } = options;

    // Base buffered stream
    let stream = source$.pipe(
      bufferTime(windowMs, undefined, maxPerWindow),
      // Flatten buffered items preserving order
      mergeMap((items) => from(items)),
    );

    // Optional debounce
    if (debounceMs > 0) {
      stream = stream.pipe(debounceTime<T>(debounceMs));
    }

    return stream.pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
      takeUntil(this.destroy$),
    );
  }

  // Create a merged event stream for a socket
  createSocketEventStream(socket: Socket): Observable<{
    type: string;
    data: unknown;
    at: Date;
  }> {
    return merge(
      fromEvent(socket as any, 'message').pipe(
        map((d) => ({ type: 'message', data: d })),
      ),
      fromEvent(socket as any, 'error').pipe(
        map((d) => ({ type: 'error', data: d })),
      ),
      fromEvent(socket as any, 'disconnect').pipe(
        map((d) => ({ type: 'disconnect', data: d })),
      ),
      fromEvent(socket as any, 'connect').pipe(
        map((d) => ({ type: 'connect', data: d })),
      ),
    ).pipe(
      map((e) => ({ ...e, at: new Date() })),
      share(),
      takeUntil(this.destroy$),
    );
  }

  // Retry with exponential backoff helper
  retryWithBackoff<T>(maxRetries: number, initialDelayMs: number) {
    return (src$: Observable<T>) =>
      src$.pipe(
        retryWhen((errors) =>
          errors.pipe(
            mergeMap((error, i) => {
              const attempt = i + 1;
              if (attempt > maxRetries) throw error;
              const delay = initialDelayMs * Math.pow(2, attempt - 1);
              this.logger.warn(`Retry ${attempt} in ${delay}ms`);
              return timer(delay);
            }),
          ),
        ),
      );
  }

  // Generic schema-based validation for any stream (protocol-agnostic)
  validateStreamWithSchema<T>(
    source$: Observable<unknown>,
    schema: ZodType<T>,
  ): Observable<T> {
    return source$.pipe(validateWithZod(schema), takeUntil(this.destroy$));
  }

  // Convenience: validate MQTT messages using shared mqttMessageSchema
  createValidatedMqttStream(
    source$: Observable<unknown>,
  ): Observable<z.infer<typeof mqttMessageSchema>> {
    return this.validateStreamWithSchema(source$, mqttMessageSchema);
  }

  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
