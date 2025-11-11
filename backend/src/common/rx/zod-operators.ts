import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ZodType } from 'zod';

// Validate each emission against a single Zod schema
export const validateWithZod =
  <T>(schema: ZodType<T>) =>
  (source$: Observable<unknown>): Observable<T> =>
    source$.pipe(map((raw) => schema.parse(raw)));
