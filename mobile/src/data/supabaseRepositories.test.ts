import type { SupabaseClient } from '@supabase/supabase-js';

import { unwrapList, unwrapOne } from '@/data/supabaseApi';
import {
  SupabaseAuthGateway,
  SupabaseEventRepository,
  SupabaseGuestRepository,
  SupabaseOrderRepository,
  SupabasePaymentGateway,
  SupabaseTicketRepository,
} from '@/data/supabaseRepositories';
import { DemoAuthGateway, IdlePresenter } from '@/data/sampleRepositories';
import { CheckoutError } from '@/services/errors';

type Row = Record<string, unknown>;

class FakeQuery {
  private rows: Row[];
  private one: Row | null = null;
  error: { message: string; code?: string } | null = null;

  constructor(rows: Row[]) {
    this.rows = rows.map((row) => ({ ...row }));
  }

  select() {
    return this;
  }

  insert(value: Row | Row[]) {
    const list = Array.isArray(value) ? value : [value];
    this.rows.push(...list);
    this.one = list[0] ?? null;
    return this;
  }

  update(value: Row) {
    this.rows = this.rows.map((row) => ({ ...row, ...value }));
    this.one = this.rows[0] ?? null;
    return this;
  }

  delete() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.rows = this.rows.filter((row) => row[column] === value);
    this.one = this.rows[0] ?? null;
    return this;
  }

  order() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve({ data: this.one, error: this.error });
  }

  single() {
    return Promise.resolve({ data: this.one, error: this.error });
  }

  then<T>(onFulfilled: (value: { data: Row[]; error: { message: string; code?: string } | null }) => T) {
    return Promise.resolve({ data: this.rows, error: this.error }).then(onFulfilled);
  }
}

function client(tables: Record<string, Row[]>, invoke?: jest.Mock): SupabaseClient {
  return {
    from(table: string) {
      return new FakeQuery(tables[table] ?? []);
    },
    functions: { invoke: invoke ?? jest.fn(async () => ({ data: { clientSecret: 'sec', paymentIntentId: 'pi_1', amount: 3500 }, error: null })) },
    auth: {
      signInWithOtp: jest.fn(async () => ({ error: null })),
      verifyOtp: jest.fn(async () => ({ error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      getUser: jest.fn(),
    },
  } as unknown as SupabaseClient;
}

const eventRow = {
  id: 'sunset-social',
  edition: '01',
  series_label: 'EVENT I · LUXURY PENTHOUSE',
  edition_label: 'EDITION NO. 01',
  name: 'Sunset Social',
  italic_tail: 'Social',
  tagline: 'A premium recurring penthouse social experience at golden hour.',
  date_label: 'Sat, Jan 23, 2027',
  long_date_label: 'Saturday, January 23, 2027',
  time_label: 'Time TBA',
  price_from_cents: 3500,
  hero: 'toast',
  status: 'on_sale',
  age_note: '21+',
  venue_public_label: 'Rooftop venue to be announced',
  card_detail: 'Sat, Jan 23, 2027',
  capacity: 60,
  host_name: 'Andrew Lowery',
  host_line: 'Sunset Social · The Tasting Room',
  sort: 1,
};

describe('Supabase repositories', () => {
  it('reads events, tiers, and an empty reveal', async () => {
    const db = client({
      events: [eventRow],
      ticket_tiers: [
        {
          id: 'golden-hour',
          event_id: 'sunset-social',
          name: 'Golden Hour',
          description: 'Admission',
          price_cents: 3500,
          max_per_order: 8,
          purchasable: true,
          sort: 1,
        },
      ],
      event_reveals: [{ event_id: 'sunset-social', venue_name: null, address: null, notes: 'later' }],
    });
    const events = new SupabaseEventRepository(db);
    expect((await events.listEvents())[0]?.name).toBe('Sunset Social');
    expect(await events.getEvent('sunset-social')).toMatchObject({ priceFromCents: 3500 });
    expect(await events.getEvent('missing')).toBeNull();
    expect((await events.listTiers('sunset-social'))[0]?.purchasable).toBe(true);
    expect(await events.getTier('golden-hour')).toMatchObject({ priceCents: 3500 });
    expect((await events.getReveal('sunset-social'))?.address).toBeNull();
  });

  it('lists tickets, counts real check-ins, and scans through the function', async () => {
    const invoke = jest.fn(async () => ({
      data: {
        outcome: 'admitted',
        guestName: 'Ada',
        tierName: 'Golden Hour',
        code: 'SS-1',
        index: 1,
        total: 1,
        sample: false,
        paidLabel: 'Paid',
      },
      error: null,
    }));
    const db = client(
      {
        tickets: [
          {
            id: 't1',
            order_id: 'o1',
            event_id: 'sunset-social',
            tier_id: 'golden-hour',
            holder_profile_id: 'user',
            guest_name: 'Ada',
            code: 'SS-1',
            status: 'checked_in',
            ticket_index: 1,
            ticket_count: 1,
            sample: false,
            tier_name: 'Golden Hour',
          },
        ],
        events: [{ id: 'sunset-social', capacity: 60 }],
      },
      invoke,
    );
    const tickets = new SupabaseTicketRepository(db);
    expect(await tickets.listSamplePreview()).toEqual([]);
    expect((await tickets.listForHolder('user'))[0]?.guestName).toBe('Ada');
    expect(await tickets.findByCode('SS-1')).toMatchObject({ code: 'SS-1' });
    expect(await tickets.guestList('sunset-social')).toHaveLength(1);
    expect(await tickets.doorCounts('sunset-social')).toEqual({ admitted: 1, capacity: 60, pending: 0, sample: false });
    expect(await tickets.markCheckedIn()).toBe(false);
    await tickets.appendCheckin({ ticketId: null, eventId: 'sunset-social', staffId: 'u', code: 'x', result: 'unknown' });
    expect((await tickets.remoteScan('SS-1', 'sunset-social'))?.outcome).toBe('admitted');
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'nope' } } as never);
    await expect(tickets.remoteScan('SS-1', 'sunset-social')).rejects.toThrow(/nope/);
  });

  it('refuses client-side order writes and reads a paid order', async () => {
    const db = client({
      orders: [
        {
          id: 'o1',
          event_id: 'sunset-social',
          tier_id: 'golden-hour',
          quantity: 1,
          total_cents: 3500,
          status: 'paid',
          payment_ref: 'pi_1',
          profile_id: 'user',
        },
      ],
      tickets: [],
    });
    const orders = new SupabaseOrderRepository(db);
    await expect(orders.createPaid({} as never)).rejects.toBeInstanceOf(CheckoutError);
    expect((await orders.waitForPayment('pi_1'))?.totalCents).toBe(3500);
    expect(await orders.waitForPayment('missing')).toBeNull();
    const reviewDb = client({
      orders: [
        { id: 'rev-1', event_id: 'sunset-social', status: 'review', review_note: 'capacity', created_at: '2026-11-22T03:00:00.000Z' },
        { id: 'paid-1', event_id: 'sunset-social', status: 'paid', review_note: null, created_at: '2026-11-22T02:00:00.000Z' },
      ],
      events: [{ id: 'sunset-social', name: 'Sunset Social' }],
    });
    const queue = await new SupabaseOrderRepository(reviewDb).listInReview();
    expect(queue).toEqual([
      {
        id: 'rev-1',
        eventId: 'sunset-social',
        eventName: 'Sunset Social',
        status: 'review',
        reviewNote: 'capacity',
        createdAt: '2026-11-22T03:00:00.000Z',
        sample: false,
      },
    ]);
  });

  it('updates a profile, waves, and follows the host', async () => {
    const db = client({
      guest_profiles: [
        {
          id: 'user',
          display_name: 'Ada',
          monogram: 'A',
          bio: '',
          show_photo: false,
          show_on_lists: true,
          notify_on_dates: false,
          tile: 'gold',
          following_host: false,
        },
      ],
      profile_visibility: [
        {
          profile_id: 'maya',
          event_id: 'sunset-social',
          show_on_wall: true,
          tier_name: 'Golden Hour',
          you_know: true,
          guest_profiles: { display_name: 'Maya R.', monogram: 'M', bio: 'Here', tile: 'gold' },
        },
      ],
      waves: [],
    });
    const guests = new SupabaseGuestRepository(db);
    expect((await guests.getProfile('user')).displayName).toBe('Ada');
    expect((await guests.updateProfile('user', { displayName: 'Ada L', notifyOnDates: true })).displayName).toBe('Ada L');
    const wall = await guests.listWall('sunset-social');
    expect(wall[0]?.displayName).toBe('Maya R.');
    expect(wall[0]?.youKnow).toBe(true);
    await expect(guests.wave('user', 'maya', 'sunset-social')).resolves.toBe(true);
    expect(await guests.setFollowing('user', true)).toBe(1);
    expect(await guests.followingCount('user')).toBe(0);
    guests.setViewer({ id: 'user', demo: false, doorStaff: true, followingHost: true, ticketEventIds: ['sunset-social'] });
    expect(guests.viewer().doorStaff).toBe(true);
  });

  it('starts a test payment intent and sends auth codes', async () => {
    const db = client({});
    const payments = new SupabasePaymentGateway(db);
    await expect(payments.createIntent({ tierId: 'golden-hour', quantity: 1, idempotencyKey: 'k' })).resolves.toMatchObject({
      paymentIntentId: 'pi_1',
    });
    const auth = new SupabaseAuthGateway(db);
    await auth.sendPhone('+12408936247');
    await auth.verifyPhone('+12408936247', '123456');
    await auth.sendEmail('ada@example.com');
    await auth.verifyEmail('ada@example.com', '123456');
    await auth.signOut();
    const demo = new DemoAuthGateway();
    await demo.sendPhone();
    await demo.verifyEmail();
    await demo.signOut();
    await demo.deleteAccount();
    const presenter = new IdlePresenter();
    await expect(presenter.present()).resolves.toBe('completed');
  });

  it('unwraps query errors', () => {
    expect(unwrapList({ data: [{ id: '1' }], error: null })).toEqual([{ id: '1' }]);
    expect(() => unwrapList({ data: null, error: { message: 'nope' } })).toThrow(/nope/);
    expect(unwrapOne({ data: null, error: null })).toBeNull();
  });
});
