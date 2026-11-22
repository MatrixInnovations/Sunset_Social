import { SampleDatabase } from '@/data/sampleDatabase';
import { SampleOrderRepository, SampleTicketRepository } from '@/data/sampleRepositories';
import { createSampleServices } from '@/bootstrap/createSampleServices';
import { isRedScan, parseTicketCode, qrPayload } from '@/domain/format';
import { CheckoutService } from '@/services/CheckoutService';
import { TicketService } from '@/services/TicketService';
import { DoorService } from '@/services/DoorService';
import { CheckoutError } from '@/services/errors';
import type { EventReader, OrderPort, PaymentGateway, PaymentPresenter } from '@/services/ports';
import type { PlacedOrder, TicketTier } from '@/domain/types';

const golden: TicketTier = {
  id: 'golden-hour',
  eventId: 'sunset-social',
  name: 'Golden Hour',
  description: 'Admission',
  priceCents: 3500,
  maxPerOrder: 8,
  purchasable: true,
  sort: 1,
};

function liveCheckout(overrides?: {
  present?: PaymentPresenter['present'];
  amount?: number;
  order?: PlacedOrder | null;
  key?: string | null;
}) {
  const catalog = {
    getTier: async () => golden,
  } as unknown as EventReader;
  const orders: OrderPort = {
    createPaid: jest.fn(),
    waitForPayment: jest.fn(async () => overrides?.order ?? null),
    listInReview: jest.fn(async () => []),
  };
  const payments: PaymentGateway = {
    createIntent: jest.fn(async () => ({
      clientSecret: 'sec_test',
      paymentIntentId: 'pi_test',
      amount: overrides?.amount ?? 7000,
    })),
  };
  const presenter: PaymentPresenter = {
    present: overrides?.present ?? jest.fn(async () => 'completed'),
  };
  const service = new CheckoutService(catalog, orders, payments, presenter, 'live', overrides?.key === undefined ? 'pk_test_123' : overrides.key);
  return { service, orders, payments, presenter };
}

describe('sample services', () => {
  it('lists the first evening and leaves The Tasting Room undated', async () => {
    const services = createSampleServices();
    const events = await services.events.list();
    expect(events.map((event) => event.id)).toEqual(['sunset-social', 'tasting-room']);
    expect(events[0]?.longWhen).toBe('Saturday, January 23, 2027');
    expect(events[0]?.timeLabel).toBe('5:00 to 8:00 PM ET');
    expect(events[0]?.priceFromCents).toBe(3500);
    expect(events[0]?.venuePublicLabel).toBe('Rooftop venue to be announced');
    expect(events[1]?.shortWhen).toBe('Jan 2027');
    expect(events[1]?.hasDate).toBe(false);
    expect(events[1]?.longWhen).toBeNull();
    expect(services.events.calendarUrl(events[1]!)).toBeNull();
    expect(services.events.calendarUrl(events[0]!)).toContain('dates=20270123T170000/20270123T200000&ctz=America/New_York');
    expect(services.events.calendarUrl(events[0]!)).not.toContain('location=');
    expect(services.events.shareMessage(events[0]!)).not.toMatch(/street|avenue/i);
    await expect(services.events.get('missing')).rejects.toThrow(/not on the calendar/);
  });

  it('keeps the venue hidden until a holder has an address, and sample data has none', async () => {
    const services = createSampleServices();
    const viewer = services.guests.viewer();
    const closed = await services.events.reveal('sunset-social', viewer);
    expect(closed.unlocked).toBe(false);
    expect(closed.address).toBeNull();
    const open = await services.events.reveal('sunset-social', { ...viewer, ticketEventIds: ['sunset-social'] });
    expect(open.unlocked).toBe(true);
    expect(open.venueName).toBeNull();
    expect(open.address).toBeNull();
    expect(open.note).toMatch(/closer to the evening/);
  });

  it('prices Golden Hour from the catalog and refuses more than 8', async () => {
    const services = createSampleServices();
    const tiers = await services.events.tiers('sunset-social');
    const hour = tiers[0]!;
    expect(services.checkout.quote(hour, 2)).toMatchObject({ totalCents: 7000, unitCents: 3500, quantity: 2 });
    expect(services.checkout.quote(hour, 8).totalCents).toBe(28000);
    expect(() => services.checkout.quote(hour, 9)).toThrow(CheckoutError);
    expect(() => services.checkout.quote(hour, 0)).toThrow(/at least one/);
    expect(() => services.checkout.quote(hour, 1.5)).toThrow(/at least one/);
    expect(() => services.checkout.quote(tiers[1]!, 1)).toThrow(/not on sale/);
    const order = await services.checkout.place({
      tierId: 'golden-hour',
      quantity: 2,
      profileId: 'sample-you',
      guestName: 'Your Name',
      idempotencyKey: 'order-1',
    });
    expect(order.sample).toBe(true);
    expect(order.tickets).toHaveLength(2);
    expect(order.tickets[0]?.code.startsWith('SAMPLE-')).toBe(true);
    const again = await services.checkout.place({
      tierId: 'golden-hour',
      quantity: 2,
      profileId: 'sample-you',
      guestName: 'Your Name',
      idempotencyKey: 'order-1',
    });
    expect(again.id).toBe(order.id);
    const wallet = await services.tickets.wallet('sample-you');
    expect(wallet.upcoming.every((ticket) => ticket.guestName === 'Your Name')).toBe(true);
    expect(wallet.past).toEqual([]);
    const db = new SampleDatabase();
    db.createPaid({
      tierId: 'golden-hour',
      quantity: 2,
      profileId: 'sample-you',
      guestName: 'Your Name',
      idempotencyKey: 'past-order',
      eventId: 'sunset-social',
      unitCents: 3500,
      totalCents: 7000,
      tierName: 'Golden Hour',
      sample: true,
      paymentRef: 'past-order',
    });
    const created = db.tickets.filter((ticket) => ticket.id.startsWith('t-new-'));
    created[0]!.eventTiming = 'past';
    created[0]!.status = 'checked_in';
    created[1]!.status = 'refunded';
    const ticketService = new TicketService(new SampleTicketRepository(db));
    const mixed = await ticketService.wallet('sample-you');
    expect(mixed.past).toHaveLength(1);
    expect(mixed.upcoming).toHaveLength(0);
    expect(await ticketService.get('missing', 'sample-you')).toBeNull();
  });

  it('shows labeled sample tickets until the viewer holds one', async () => {
    const services = createSampleServices();
    const wallet = await services.tickets.wallet('sample-you');
    expect(wallet.sample).toBe(true);
    expect(wallet.upcoming.map((ticket) => ticket.code)).toEqual(['SAMPLE-SS01-0001', 'SAMPLE-SS01-0002']);
    expect(wallet.upcoming.some((ticket) => ticket.status === 'refunded')).toBe(false);
    const found = await services.tickets.get('t-1', 'sample-you');
    expect(found?.guestName).toBe('Sample Guest');
  });

  it('opens the sample guest wall and locks it for a guest without a ticket', async () => {
    const services = createSampleServices();
    const open = await services.guests.wall('sunset-social', services.guests.viewer());
    expect(open.locked).toBe(false);
    if (!open.locked) {
      expect(open.going).toBe(6);
      expect(open.youKnow).toBe(2);
      expect(open.sample).toBe(true);
      expect(open.people.map((person) => person.displayName)).toContain('Maya R.');
    }
    const locked = await services.guests.wall('sunset-social', {
      ...services.guests.viewer(),
      demo: false,
      ticketEventIds: [],
    });
    expect(locked).toEqual({ locked: true, reason: 'The guest list is visible to ticket holders.' });
    const holder = await services.guests.wall('sunset-social', {
      ...services.guests.viewer(),
      demo: false,
      ticketEventIds: ['sunset-social'],
    });
    expect(holder.locked).toBe(false);
    await expect(services.guests.wave('sample-you', 'sample-you', 'sunset-social')).rejects.toThrow(/yourself/);
    await expect(services.guests.wave('sample-you', 'maya', 'sunset-social')).resolves.toBe(true);
    await expect(services.guests.wave('sample-you', 'maya', 'sunset-social')).resolves.toBe(true);
    await expect(services.guests.update('sample-you', { bio: 'x'.repeat(161) })).rejects.toThrow(/160/);
    await expect(services.guests.update('sample-you', { displayName: '   ' })).rejects.toThrow(/name/);
    const renamed = await services.guests.update('sample-you', { displayName: 'Ada', bio: 'Here for the light.' });
    expect(renamed.monogram).toBe('A');
    expect(renamed.bio).toBe('Here for the light.');
    const stats = await services.guests.stats('sample-you');
    expect(stats.evenings).toBe(0);
    expect(stats.tickets).toBe(0);
    expect(await services.guests.setFollowing('sample-you', false)).toBe(0);
  });

  it('admits a valid code, turns a second scan into a duplicate, and turns refunded red', async () => {
    const services = createSampleServices();
    const viewer = services.guests.viewer();
    expect(services.door.samplePreview()?.sample).toBe(true);
    const counts = await services.door.counts('sunset-social');
    expect(counts).toMatchObject({ admitted: 42, capacity: 60, pending: 3, sample: true });
    const admitted = await services.door.scan('SUNSETSOCIAL:TICKET:SAMPLE-SS01-0001', 'sunset-social', viewer);
    expect(admitted.outcome).toBe('admitted');
    expect(qrPayload('SAMPLE-SS01-0001')).toBe('SUNSETSOCIAL:TICKET:SAMPLE-SS01-0001');
    expect(parseTicketCode('  SUNSETSOCIAL:TICKET:SAMPLE-SS01-0001 ')).toBe('SAMPLE-SS01-0001');
    const duplicate = await services.door.scan('SAMPLE-SS01-0001', 'sunset-social', viewer);
    expect(duplicate.outcome).toBe('duplicate');
    const refunded = await services.door.scan('SAMPLE-SS01-0099', 'sunset-social', viewer);
    expect(refunded.outcome).toBe('refunded');
    expect(isRedScan(refunded.outcome)).toBe(true);
    const unknown = await services.door.scan('NO-SUCH', 'sunset-social', viewer);
    expect(unknown.outcome).toBe('unknown');
    expect(isRedScan('void')).toBe(true);
    expect(isRedScan('admitted')).toBe(false);
    const after = await services.door.counts('sunset-social');
    expect(after.admitted).toBe(43);
    const found = await services.door.search('sunset-social', 'maya');
    expect(found).toHaveLength(1);
    expect(await services.door.search('sunset-social', '')).toHaveLength(9);
    await expect(
      services.door.scan('SAMPLE-SS01-0002', 'sunset-social', { ...viewer, demo: false, doorStaff: false }),
    ).rejects.toThrow(/host/);
  });

  it('rejects the wrong evening and a void code', async () => {
    const db = new SampleDatabase();
    const moved = db.tickets[0]!;
    moved.eventId = 'tasting-room';
    db.tickets[1]!.status = 'void';
    const door = new DoorService(new SampleTicketRepository(db), new SampleOrderRepository(db), true);
    const wrong = await door.scan(moved.code, 'sunset-social', db.viewerState);
    expect(wrong.outcome).toBe('wrong_event');
    const voided = await door.scan(db.tickets[1]!.code, 'sunset-social', db.viewerState);
    expect(voided.outcome).toBe('void');
    expect(door.judge({ ...db.tickets[2]!, status: 'transferred' }, 'sunset-social')).toBe('void');
    const blank = await door.scan('   ', 'sunset-social', db.viewerState);
    expect(blank.outcome).toBe('unknown');
  });

  it('uses a server scan when the ticket port returns one', async () => {
    const db = new SampleDatabase();
    const tickets = new SampleTicketRepository(db);
    tickets.remoteScan = async () => ({
      outcome: 'refunded' as const,
      guestName: 'Sample Guest',
      tierName: 'Golden Hour',
      code: 'SAMPLE-SS01-0099',
      index: 1,
      total: 1,
      sample: true,
      paidLabel: 'Refunded',
    });
    const door = new DoorService(tickets, new SampleOrderRepository(db), false);
    expect(door.samplePreview()).toBeNull();
    const result = await door.scan('anything', 'sunset-social', { ...db.viewerState, demo: false, doorStaff: true });
    expect(result.outcome).toBe('refunded');
    expect(db.checkins).toHaveLength(0);
    const reviews = await new DoorService(new SampleTicketRepository(db), new SampleOrderRepository(db), true).reviews(db.viewerState);
    expect(reviews[0]).toMatchObject({ id: 'sample-review-order', status: 'review', reviewNote: 'capacity', sample: true });
    const hidden = await new DoorService(tickets, new SampleOrderRepository(db), false).reviews({
      ...db.viewerState,
      demo: false,
      doorStaff: false,
    });
    expect(hidden).toEqual([]);
  });
});

describe('CheckoutService live payments', () => {
  const input = {
    tierId: 'golden-hour',
    quantity: 2,
    profileId: 'user',
    guestName: 'Ada',
    idempotencyKey: 'idem',
  };

  it('refuses a live secret and a missing test key', async () => {
    const live = liveCheckout({ key: 'pk_live_nope' });
    await expect(live.service.place(input)).rejects.toThrow(/Live Stripe keys are refused/);
    const missing = liveCheckout({ key: null });
    await expect(missing.service.place(input)).rejects.toThrow(/test publishable key/);
    const demo = createSampleServices();
    await expect(demo.checkout.place({ ...input, guestName: '  ' })).rejects.toThrow(/name/);
    await expect(demo.checkout.place({ ...input, tierId: 'missing' })).rejects.toThrow(/not found/);
  });

  it('presents PaymentSheet and waits for the server-issued order', async () => {
    const order = { id: 'o1', tickets: [], totalCents: 7000 } as unknown as PlacedOrder;
    const { service, presenter, payments } = liveCheckout({ order });
    await expect(service.place(input)).resolves.toBe(order);
    expect(payments.createIntent).toHaveBeenCalledWith({ tierId: 'golden-hour', quantity: 2, idempotencyKey: 'idem' });
    expect(presenter.present).toHaveBeenCalledWith('sec_test');
  });

  it('stops when the sheet is canceled, fails, or the amount disagrees', async () => {
    const canceled = liveCheckout({ present: async () => 'canceled' });
    await expect(canceled.service.place(input)).rejects.toThrow(/canceled/);
    const failed = liveCheckout({ present: async () => 'failed' });
    await expect(failed.service.place(input)).rejects.toThrow(/did not complete/);
    const mismatch = liveCheckout({ amount: 1 });
    await expect(mismatch.service.place(input)).rejects.toThrow(/does not match/);
    const pending = liveCheckout({ order: null });
    await expect(pending.service.place(input)).rejects.toThrow(/still being issued/);
  });
});
