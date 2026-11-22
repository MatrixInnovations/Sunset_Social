import type { SupabaseClient } from '@supabase/supabase-js';

export type DbError = { message: string; code?: string };
export type DbResult<T> = { data: T | null; error: DbError | null };

export interface RowQuery {
  select(columns?: string): RowQuery;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): RowQuery;
  update(values: Record<string, unknown>): RowQuery;
  delete(): RowQuery;
  eq(column: string, value: string | number | boolean): RowQuery;
  order(column: string, options?: { ascending: boolean }): RowQuery;
  maybeSingle(): Promise<DbResult<Record<string, unknown>>>;
  single(): Promise<DbResult<Record<string, unknown>>>;
  then<TResult1 = DbResult<Record<string, unknown>[]>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<Record<string, unknown>[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

type LooseBuilder = RowQuery;

export function table(client: SupabaseClient, name: string): RowQuery {
  return client.from(name) as unknown as LooseBuilder;
}

export function unwrapList(result: DbResult<Record<string, unknown>[]>): Record<string, unknown>[] {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data ?? [];
}

export function unwrapOne<T>(result: DbResult<T>): T | null {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data;
}
