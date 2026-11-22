import fs from 'fs';
import path from 'path';

import { CheckoutService } from '@/services/CheckoutService';
import type { EventReader, OrderPort, PaymentGateway, PaymentPresenter } from '@/services/ports';
import type { PlacedOrder, TicketTier } from '@/domain/types';
import {
  decideRefund,
  decideSucceeded,
  exceedsCapacity,
  newCheckoutAttemptId,
  type IntentView,
} from '../../supabase/functions/_shared/fulfillment';

const root = path.join(__dirname, '../..');
const migration = () => fs.readFileSync(path.join(root, 'supabase/migrations/20261122140000_fulfillment_guards.sql'), 'utf8');
const webhook = () => fs.readFileSync(path.join(root, 'supabase/functions/stripe-webhook/index.ts'), 'utf8');
const payment = () => fs.readFileSync(path.join(root, 'supabase/functions/create-payment-intent/index.ts'), 'utf8');

function intent(overrides: Partial<IntentView> = {}): IntentView {
  return {
    id: 'pi_test',
    amount: 7000,
    currency: 'usd',
    status: 'succeeded',
    livemode: false,
    metadata: {
      app: 'sunset-social',
      tier_id: 'golden-hour',
      user_id: 'user-1',
      quantity: '2',
      unit_price_cents: '3500',
    },
    ...overrides,
  };
}

describe('must-fix fulfillment decisions', () => {
  it('issues only a tagged test-mode intent whose amount matches the agreed unit price', () => {
    expect(decideSucceeded(intent()).kind).toBe('issue');
    expect(decideSucceeded(intent({ livemode: true }))).toEqual({ kind: 'ignore', reason: 'livemode' });
    expect(decideSucceeded(intent({ metadata: { app: 'other' } }))).toEqual({ kind: 'ignore', reason: 'app' });
    expect(decideSucceeded(intent({ metadata: { app: 'sunset-social' } })).kind).toBe('review');
    expect(decideSucceeded(intent({ currency: 'eur' }))).toMatchObject({ kind: 'review', reason: 'currency' });
    expect(decideSucceeded(intent({ status: 'processing' }))).toMatchObject({ kind: 'review', reason: 'status' });
    expect(decideSucceeded(intent({ amount: 3500 }))).toMatchObject({ kind: 'review', reason: 'amount' });
  });

  it('does not treat a price change in the database as the agreed price', () => {
    const decision = decideSucceeded(intent());
    expect(decision.kind).toBe('issue');
    if (decision.kind === 'issue') {
      expect(decision.unitPriceCents).toBe(3500);
      expect(decision.amount).toBe(7000);
    }
  });

  it('enforces event and tier capacity before another seat is sold', () => {
    expect(exceedsCapacity(58, 60, 2)).toBe(false);
    expect(exceedsCapacity(59, 60, 2)).toBe(true);
    expect(exceedsCapacity(10, null, 8)).toBe(false);
    expect(exceedsCapacity(8, 8, 1)).toBe(true);
  });

  it('marks a refund that arrives before the order, and only voids a full refund', () => {
    expect(decideRefund({ amount: 7000, amountRefunded: 7000, paymentIntentId: 'pi_test', refunded: true })).toBe('full');
    expect(decideRefund({ amount: 7000, amountRefunded: 3500, paymentIntentId: 'pi_test', refunded: false })).toBe('partial');
    expect(decideRefund({ amount: 7000, amountRefunded: 0, paymentIntentId: null, refunded: false })).toBe('ignore');
  });

  it('mints a fresh checkout attempt id instead of user+tier+quantity', () => {
    const first = newCheckoutAttemptId();
    const second = newCheckoutAttemptId();
    expect(first).not.toBe(second);
    expect(first).not.toMatch(/golden-hour/);
    const source = fs.readFileSync(path.join(root, 'src/services/CheckoutService.ts'), 'utf8');
    expect(source).not.toContain('${input.profileId}:${tier.id}');
    expect(source).toContain('newCheckoutAttemptId');
  });
});

describe('must-fix schema', () => {
  const sql = migration();

  it('issues the order and its tickets in one security-definer transaction', () => {
    expect(sql).toContain('function public.issue_order');
    expect(sql).toContain('for update of e, t');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('revoke all on function public.issue_order');
    expect(sql).toContain('grant execute on function public.issue_order');
    expect(webhook()).toContain("rpc('issue_order'");
    expect(webhook()).not.toContain("error: 'Amount mismatch.'");
    expect(webhook()).toContain('ignored: decision.reason');
  });

  it('locks capacity for the event and the tier inside that transaction', () => {
    expect(sql).toContain('v_sold + (p_qty - coalesce(v_have, 0)) > v_event_capacity');
    expect(sql).toContain('v_tier_sold + (p_qty - coalesce(v_have, 0)) > v_tier_capacity');
    expect(sql).toContain("'capacity'");
    expect(payment()).toContain('exceedsCapacity');
    expect(payment()).toContain('unit_price_cents');
  });

  it('lets a person with an order and a wave delete their account', () => {
    expect(sql).toContain('orders_profile_id_fkey');
    expect(sql).toContain('on delete set null');
    expect(sql).toContain('tickets_holder_profile_id_fkey');
    expect(sql).toContain('on delete cascade');
    expect(sql).toContain('void_tickets_before_profile_delete');
    expect(sql).toContain("set status = 'void'");
  });

  it('refunds an oversell with an idempotency key and remembers a refund inside issue_order', () => {
    const hook = webhook();
    expect(hook).toContain("rpc('record_refund'");
    expect(hook).toContain('idempotencyKey: `refund_${intentId}`');
    expect(hook).toContain('refund_failed:');
    expect(hook).toContain("'missing_profile'");
    expect(hook).not.toContain("from('refund_markers')");
    const screen = fs.readFileSync(path.join(root, 'src/screens/CheckoutScreen.tsx'), 'utf8');
    expect(screen).toContain('attempt.current = null');
  });

  it('revokes the broad default grants and clears the search path', () => {
    expect(sql).toContain('revoke all on all tables in schema public from anon, authenticated');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('insert into public.guest_profiles');
    const http = fs.readFileSync(path.join(root, 'supabase/functions/_shared/http.ts'), 'utf8');
    expect(http).toContain('access-control-allow-methods');
    expect(payment()).toContain('}, 502)');
  });
});

describe('checkout attempts', () => {
  const tier: TicketTier = {
    id: 'golden-hour',
    eventId: 'sunset-social',
    name: 'Golden Hour',
    description: 'Admission',
    priceCents: 3500,
    maxPerOrder: 8,
    purchasable: true,
    sort: 1,
  };

  it('uses the caller key for a retry and a new key for the next purchase', async () => {
    const created: string[] = [];
    const orders: OrderPort = {
      createPaid: jest.fn(async (input) => {
        created.push(input.paymentRef);
        return { id: input.paymentRef, paymentRef: input.paymentRef, tickets: [] } as unknown as PlacedOrder;
      }),
      waitForPayment: jest.fn(),
    };
    const payments: PaymentGateway = { createIntent: jest.fn() };
    const presenter: PaymentPresenter = { present: jest.fn() };
    const service = new CheckoutService({ getTier: async () => tier } as unknown as EventReader, orders, payments, presenter, 'demo', null);
    const input = { tierId: 'golden-hour', quantity: 2, profileId: 'sample-you', guestName: 'Your Name' };
    const retryA = await service.place({ ...input, idempotencyKey: 'attempt-a' });
    const retryB = await service.place({ ...input, idempotencyKey: 'attempt-a' });
    const next = await service.place(input);
    expect(retryA.paymentRef).toBe('attempt-a');
    expect(retryA.tickets[0]?.code).toBe('SAMPLE-SS01-0001');
    expect(retryB.paymentRef).toBe('attempt-a');
    expect(next.paymentRef).not.toBe('attempt-a');
    expect(next.tickets[0]?.sample).toBe(true);
    expect(new Set(created).size).toBe(2);
  });
});
