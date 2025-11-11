import { Injectable, Logger } from '@nestjs/common';
import { BehaviorSubject, Observable } from 'rxjs';

type OperationRecord = {
  id: string;
  type: string;
  startedAt: number;
  endedAt?: number;
  success?: boolean;
};

export type PerformanceReport = {
  timestamp: Date;
  totals: {
    operations: number;
    successes: number;
    failures: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
  };
};

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private readonly operations = new Map<string, OperationRecord>();
  private readonly reportSubject = new BehaviorSubject<PerformanceReport>({
    timestamp: new Date(),
    totals: {
      operations: 0,
      successes: 0,
      failures: 0,
      avgMs: 0,
      minMs: 0,
      maxMs: 0,
    },
  });

  // TODO: Extend to categorized reports (device/quota) in Phase 3

  start(operationId: string, type: string): void {
    this.operations.set(operationId, {
      id: operationId,
      type,
      startedAt: Date.now(),
    });
  }

  end(operationId: string, success: boolean): void {
    const rec = this.operations.get(operationId);
    if (!rec) return;
    rec.endedAt = Date.now();
    rec.success = success;
    this.operations.set(operationId, rec);

    // push reactive update
    this.reportSubject.next(this.report());
  }

  report(): PerformanceReport {
    const finished = Array.from(this.operations.values()).filter(
      (r) => r.endedAt,
    );
    const durations = finished.map((r) => r.endedAt! - r.startedAt);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = durations.length ? sum / durations.length : 0;
    const min = durations.length ? Math.min(...durations) : 0;
    const max = durations.length ? Math.max(...durations) : 0;
    const successes = finished.filter((r) => r.success).length;
    const failures = finished.filter((r) => r.success === false).length;

    return {
      timestamp: new Date(),
      totals: {
        operations: finished.length,
        successes,
        failures,
        avgMs: Math.round(avg),
        minMs: Math.round(min),
        maxMs: Math.round(max),
      },
    };
  }

  getReport$(): Observable<PerformanceReport> {
    return this.reportSubject.asObservable();
  }
}
