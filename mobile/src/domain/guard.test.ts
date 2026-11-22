import fs from 'fs';
import path from 'path';

import { readPublishableKey, resolveMode } from '@/lib/env';
import { formatMoney, formatReviewTime, formatTicketCode, isRedScan, scanTitle } from '@/domain/format';
import { mapEventRow, mapTicketRow, mapTierRow } from '@/data/rowMappers';
import { SentryReporter } from '@/observability/SentryReporter';
import { LaterRelease } from '@/services/LaterRelease';
import { AuthService } from '@/services/AuthService';
import { ExpoNotificationGateway, NotificationService } from '@/services/NotificationService';
import * as Notifications from 'expo-notifications';
import { createAppServices, createLiveServices } from '@/bootstrap/createAppServices';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthGateway } from '@/services/ports';

const root = path.join(__dirname, '../..');

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'coverage' || entry.name === 'dist') return [];
      return filesUnder(full);
    }
    return /\.(ts|tsx|sql|md)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')
      ? [full]
      : [];
  });
}

describe('copy guardrails', () => {
  const banned = ['Soft' + ' Doctor', 'En' + 'voi', 'North ' + 'Bethesda'];

  it('does not name a venue, a city from the plan, or shorten the credit', () => {
    const corpus = filesUnder(path.join(root, 'src'))
      .concat(filesUnder(path.join(root, 'supabase')))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    for (const phrase of banned) {
      expect(corpus).not.toContain(phrase);
    }
    expect(corpus).not.toMatch(/\b\d{1,5}\s+[A-Z][a-z]+\s+(Street|Avenue|Road|Boulevard|Lane|Drive)\b/);
    expect(corpus).toContain('The Software Doctor');
    expect(corpus).toContain('Saturday, January 23, 2027');
    expect(corpus).toContain('Jan 2027');
    expect(corpus).toContain('Yeshua is Lord');
    expect(corpus).toContain('Text (240) 893-6247');
  });

  it('refuses live Stripe keys and defaults to the sample provider', () => {
    expect(resolveMode({})).toBe('demo');
    expect(resolveMode({ EXPO_PUBLIC_DATA_PROVIDER: 'sample', EXPO_PUBLIC_SUPABASE_URL: 'x', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'y' })).toBe('demo');
    expect(resolveMode({ EXPO_PUBLIC_DATA_PROVIDER: 'supabase' })).toBe('demo');
    expect(
      resolveMode({
        EXPO_PUBLIC_DATA_PROVIDER: 'supabase',
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toBe('live');
    expect(readPublishableKey({})).toBeNull();
    expect(readPublishableKey({ EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc' })).toBe('pk_test_abc');
    expect(readPublishableKey({ EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'not-a-key' })).toBeNull();
    expect(() => readPublishableKey({ EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_no' })).toThrow(/Test mode only/);
  });

  it('formats money, codes, and scan titles', () => {
    expect(formatMoney(3500)).toBe('$35');
    expect(formatMoney(7000, 'always')).toBe('$70.00');
    expect(formatMoney(3510)).toBe('$35.10');
    expect(formatReviewTime('2026-11-22T03:00:00.000Z', 'America/New_York')).toBe('Nov 21, 10:00 PM ET');
    expect(formatReviewTime('2026-11-22T03:00:00.000Z', 'UTC')).toBe('Nov 22, 3:00 AM UTC');
    expect(formatReviewTime('2026-11-22T03:00:00.000Z', 'Europe/London')).toBe('Nov 22, 3:00 AM GMT');
    expect(formatReviewTime('not-a-time')).toBe('not-a-time');
    expect(formatTicketCode('SAMPLE-SS01-0001')).toBe('SAMPLE · SS01-0001');
    expect(formatTicketCode('SS-ABC')).toBe('SS-ABC');
    expect(scanTitle('admitted', 1, 2)).toBe('ADMITTED · 1 OF 2');
    expect(scanTitle('refunded', null, null)).toBe('REFUNDED');
    expect(scanTitle('duplicate', null, null)).toBe('ALREADY INSIDE');
    expect(scanTitle('unknown', null, null)).toBe('NOT A TICKET');
    expect(scanTitle('wrong_event', null, null)).toBe('WRONG EVENING');
    expect(scanTitle('void', null, null)).toBe('NOT VALID');
    expect(isRedScan('wrong_event')).toBe(true);
  });

  it('maps database rows without inventing an address', () => {
    const event = mapEventRow({
      id: 'sunset-social',
      edition: '01',
      series_label: 'EVENT I · LUXURY PENTHOUSE',
      edition_label: 'EDITION NO. 01',
      name: 'Sunset Social',
      italic_tail: 'Social',
      tagline: 'A premium recurring penthouse social experience at golden hour.',
      date_label: 'Sat, Jan 23, 2027',
      long_date_label: 'Saturday, January 23, 2027',
      time_label: '5:00 to 8:00 PM ET',
      price_from_cents: 3500,
      hero: 'toast',
      status: 'on_sale',
      age_note: '21+',
      venue_public_label: 'Rooftop venue to be announced',
      card_detail: 'Sat, Jan 23, 2027',
      capacity: 60,
      host_name: 'Andrew Lowery',
      host_line: 'Sunset Social · The Tasting Room',
    });
    expect(event.hasDate).toBe(true);
    expect(event.priceFromCents).toBe(3500);
    const tasting = mapEventRow({
      id: 'tasting-room',
      edition: '02',
      series_label: 'EVENT II',
      edition_label: 'THE TASTING ROOM',
      name: 'The Tasting Room',
      tagline: 'The second evening. The date is still open.',
      date_label: 'Jan 2027',
      time_label: '',
      hero: 'tasting',
      status: 'announced',
      venue_public_label: '',
      card_detail: 'Jan 2027 · 21+',
      host_name: '',
      host_line: '',
    });
    expect(tasting.hasDate).toBe(false);
    expect(tasting.venuePublicLabel).toBe('Rooftop venue to be announced');
    expect(mapTierRow({ id: 'golden-hour', event_id: 'sunset-social', name: 'Golden Hour', description: 'Admission', price_cents: 3500, max_per_order: 8, purchasable: true, sort: 1 }).purchasable).toBe(true);
    const ticket = mapTicketRow({
      id: '1',
      order_id: 'o',
      event_id: 'sunset-social',
      tier_id: 'golden-hour',
      holder_profile_id: 'p',
      guest_name: 'Sample Guest',
      code: 'SAMPLE-SS01-0001',
      status: 'valid',
      ticket_index: 1,
      ticket_count: 2,
      sample: true,
      date_month: 'JAN',
      date_day: '23',
      date_year: '2027',
      date_weekday: 'Saturday',
      date_time: '5:00 to 8:00 PM ET',
    });
    expect(ticket.date?.day).toBe('23');
    expect(ticket.venueLabel).toBe('Revealed to ticket holders');
  });
});

describe('stubs', () => {
  const gateway: AuthGateway = {
    sendPhone: jest.fn(),
    verifyPhone: jest.fn(),
    sendEmail: jest.fn(),
    verifyEmail: jest.fn(),
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
  };

  it('keeps auth, notifications, sentry, and later releases quiet in demo', async () => {
    const auth = new AuthService(gateway, 'demo');
    expect(auth.normalizeUsPhone('(240) 893-6247')).toBe('+12408936247');
    expect(auth.normalizeUsPhone('12408936247')).toBe('+12408936247');
    expect(() => auth.normalizeUsPhone('555')).toThrow(/U\.S\./);
    expect(auth.assertEmail('Ada@Example.com')).toBe('ada@example.com');
    expect(() => auth.assertEmail('nope')).toThrow(/email/);
    await expect(auth.sendPhone('2408936247')).rejects.toThrow(/Demo mode/);
    await expect(auth.verifyEmail('ada@example.com', '123456')).rejects.toThrow(/Demo mode/);
    await auth.signOut();
    await auth.deleteAccount();
    const live = new AuthService(gateway, 'live');
    await live.sendEmail('ada@example.com');
    await expect(live.verifyPhone('2408936247', '12')).rejects.toThrow(/6-digit/);
    await live.verifyPhone('2408936247', '123456');
    expect(gateway.verifyPhone).toHaveBeenCalledWith('+12408936247', '123456');
    const notes = new NotificationService('demo', { register: async () => 'registered' });
    await expect(notes.syncDateDrop(false)).resolves.toEqual({ state: 'off' });
    await expect(notes.syncDateDrop(true)).resolves.toEqual({ state: 'stub' });
    const liveNotes = new NotificationService('live', { register: async () => 'registered' });
    await expect(liveNotes.syncDateDrop(true)).resolves.toEqual({ state: 'registered' });
    const silent = new SentryReporter(null);
    silent.capture(new Error('nope'));
    expect(silent.enabled).toBe(false);
    expect(silent.drain()).toEqual([]);
    const loud = new SentryReporter('https://example.ingest');
    loud.capture(new Error('boom'));
    loud.capture('plain');
    expect(loud.drain()).toEqual(['Error: boom', 'plain']);
    const later = new LaterRelease();
    expect(later.walletPass()).toMatch(/later release/);
    expect(later.transfer()).toMatch(/later release/);
    expect(later.promo()).toMatch(/later release/);
    expect(later.lounge()).toMatch(/closer to the evening/);
    expect(later.approvals()).toMatch(/later release/);
    expect(later.directions()).toMatch(/revealed to ticket holders/);
    expect(later.waitlist()).toMatch(/sells out/);
    const pushGateway = new ExpoNotificationGateway();
    await expect(pushGateway.register()).resolves.toBe('stub');
    const notifications = Notifications as unknown as {
      getPermissionsAsync: jest.Mock;
      requestPermissionsAsync: jest.Mock;
    };
    notifications.getPermissionsAsync.mockResolvedValueOnce({ granted: false });
    notifications.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await expect(pushGateway.register()).resolves.toBe('stub');
    notifications.getPermissionsAsync.mockRejectedValueOnce(new Error('no module'));
    await expect(pushGateway.register()).resolves.toBe('stub');
    const demo = createAppServices({ EXPO_PUBLIC_DATA_PROVIDER: 'sample' });
    expect(demo.mode).toBe('demo');
    const chain = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: null, error: null }),
      then(resolve: (value: { data: never[]; error: null }) => unknown) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    const liveServices = createLiveServices(
      { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => chain } as unknown as SupabaseClient,
      'pk_test_123',
      null,
    );
    expect((await liveServices.refreshViewer()).demo).toBe(false);
    expect(() =>
      createAppServices({
        EXPO_PUBLIC_DATA_PROVIDER: 'supabase',
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_no',
      }),
    ).toThrow(/Test mode only/);
  });

  it('keeps the payment intent function on test keys and server prices', () => {
    const source = fs.readFileSync(path.join(root, 'supabase/functions/create-payment-intent/index.ts'), 'utf8');
    const shared = fs.readFileSync(path.join(root, 'supabase/functions/_shared/http.ts'), 'utf8');
    const checkIn = fs.readFileSync(path.join(root, 'supabase/functions/check-in/index.ts'), 'utf8');
    const webhook = fs.readFileSync(path.join(root, 'supabase/functions/stripe-webhook/index.ts'), 'utf8');
    expect(source).toContain('requireTestKey');
    expect(shared).toContain("startsWith('sk_test_')");
    expect(source).toContain('price_cents');
    expect(source).not.toContain('body.amount');
    expect(source).not.toContain('body.price');
    expect(checkIn).toContain('staff_roles');
    expect(checkIn).toContain('refunded');
    expect(webhook).toContain("rpc('issue_order'");
    expect(webhook).not.toContain("error: 'Amount mismatch.'");
  });
});
