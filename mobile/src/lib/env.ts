import type { DataMode } from '@/domain/types';

export type AppEnv = Record<string, string | undefined>;

export function resolveMode(env: AppEnv = process.env): DataMode {
  const flag = env.EXPO_PUBLIC_DATA_PROVIDER?.trim().toLowerCase();
  const hasSupabase = Boolean(env.EXPO_PUBLIC_SUPABASE_URL && env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  if (flag === 'sample' || flag === 'demo') {
    return 'demo';
  }
  if (flag === 'supabase' || flag === 'live') {
    return hasSupabase ? 'live' : 'demo';
  }
  return hasSupabase ? 'live' : 'demo';
}

export function readPublishableKey(env: AppEnv = process.env): string | null {
  const key = env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
  if (!key) {
    return null;
  }
  if (key.startsWith('pk_live_')) {
    throw new Error('Live Stripe keys are refused. Test mode only.');
  }
  if (!key.startsWith('pk_test_')) {
    return null;
  }
  return key;
}

export function readSentryDsn(env: AppEnv = process.env): string | null {
  const dsn = env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? '';
  return dsn.length > 0 ? dsn : null;
}
