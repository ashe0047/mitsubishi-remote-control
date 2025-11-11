import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, timer } from 'rxjs';
import { catchError, map, mergeMap, retryWhen } from 'rxjs/operators';
import type { ZodTypeAny, ZodType } from 'zod';
import type { MqttMessage } from '../mqtt.service';
import { validateWithZod } from '../../../common/rx/zod-operators';
import { ErrorHandlerService } from '../../errors/services/error-handler.service';

export interface MqttStreamingOptions {
  parseJsonPayload?: boolean;
  strict?: boolean; // when true, throw on validation error after retries; when false, drop invalid
  maxRetries?: number;
  initialDelayMs?: number;
}

@Injectable()
export class MqttStreamingService {
  private readonly logger = new Logger(MqttStreamingService.name);
  private readonly errorSubject = new Subject<{
    error: unknown;
    context?: Record<string, unknown>;
  }>();

  private defaults: Required<MqttStreamingOptions> = {
    parseJsonPayload: true,
    strict: false,
    maxRetries: 3,
    initialDelayMs: 500,
  };

  constructor(private readonly errorHandler: ErrorHandlerService) {}

  // Map MQTT raw to a generic { topic, payload } object with optional JSON parsing
  private toGeneric(options?: MqttStreamingOptions) {
    const cfg = { ...this.defaults, ...options };
    return map<MqttMessage, { topic: string; payload: unknown }>((msg) => {
      let payload: unknown = msg.payload;
      if (cfg.parseJsonPayload && Buffer.isBuffer(msg.payload)) {
        const text = msg.payload.toString('utf8');
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text; // fallback to string payload
        }
      }
      return { topic: msg.topic, payload };
    });
  }

  private backoff(options?: MqttStreamingOptions) {
    const cfg = { ...this.defaults, ...options };
    return <T>(source$: Observable<T>) =>
      source$.pipe(
        retryWhen((errors) =>
          errors.pipe(
            mergeMap((err, i) => {
              const attempt = i + 1;
              if (attempt > cfg.maxRetries) throw err;
              const delay = Math.min(
                cfg.initialDelayMs * Math.pow(2, i),
                15000,
              );
              this.errorHandler.logWarning('MQTT stream validation retry', {
                attempt,
                delay,
                message: this.errorHandler.safeMessage(err),
              });
              return timer(delay);
            }),
          ),
        ),
        catchError((err) => {
          if (cfg.strict) {
            this.errorHandler.handleServiceError(
              err,
              'mqtt-stream-validate',
              undefined,
              true,
            );
          }
          // non-strict: report and drop
          this.errorSubject.next({
            error: err,
            context: { operation: 'mqtt-stream-validate' },
          });
          return new Observable<T>((subscriber) => subscriber.complete());
        }),
      );
  }

  // Validate against a single schema; returns typed messages
  createTypedStream<T>(
    raw$: Observable<MqttMessage>,
    schema: ZodType<T>,
    options?: MqttStreamingOptions,
  ): Observable<T> {
    return raw$.pipe(
      this.toGeneric(options),
      validateWithZod(schema),
      this.backoff(options),
    );
  }

  // Validate against a Zod union schema; returns typed union messages
  createTypedUnionStream<T>(
    raw$: Observable<MqttMessage>,
    unionSchema: ZodType<T>,
    options?: MqttStreamingOptions,
  ): Observable<T> {
    return raw$.pipe(
      this.toGeneric(options),
      validateWithZod(unionSchema),
      this.backoff(options),
    );
  }

  // Route by exact topic to schema map; returns object with topic + typed message
  // NOTE: wildcard matching can be added later (TODO)
  createTopicRoutedTypedStream<R extends Record<string, ZodTypeAny>>(
    raw$: Observable<MqttMessage>,
    routes: R,
    options?: MqttStreamingOptions,
  ): Observable<{ topic: string; message: unknown }> {
    const routeKeys = Object.keys(routes);
    return raw$.pipe(
      this.toGeneric(options),
      map(({ topic, payload }) => {
        if (routeKeys.includes(topic)) {
          const schema = routes[topic as keyof R] as ZodTypeAny;
          const message = schema.parse(payload) as never;
          return { topic, message };
        }
        // Unmapped topics pass through (caller may filter)
        return { topic, message: payload };
      }),
      this.backoff(options),
    );
  }

  // Expose error stream for monitoring/metrics subscribers
  getErrors(): Observable<{
    error: unknown;
    context?: Record<string, unknown>;
  }> {
    return this.errorSubject.asObservable();
  }
}
