/**
 * Pure decisions for the Stripe webhook. The edge function and the issue_order
 * transaction both follow these outcomes. A non-2xx here would make Stripe retry
 * for days, so business problems return a 200 review instead.
 */

export type IntentView = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  livemode: boolean;
  metadata: Record<string, string | undefined>;
};

export type SucceededDecision =
  | { kind: 'ignore'; reason: 'livemode' | 'app' }
  | { kind: 'review'; reason: 'incomplete' | 'currency' | 'status' | 'amount' }
  | {
      kind: 'issue';
      tierId: string;
      userId: string;
      quantity: number;
      unitPriceCents: number;
      amount: number;
    };

export type ChargeView = {
  amount: number;
  amountRefunded: number;
  paymentIntentId: string | null;
  refunded: boolean;
};

export type RefundDecision = 'ignore' | 'full' | 'partial';

const APP = 'sunset-social';

export function exceedsCapacity(sold: number, capacity: number | null, quantity: number): boolean {
  if (capacity == null) return false;
  return sold + quantity > capacity;
}

export function decideSucceeded(intent: IntentView): SucceededDecision {
  if (intent.livemode) return { kind: 'ignore', reason: 'livemode' };
  if (intent.metadata.app !== APP) return { kind: 'ignore', reason: 'app' };

  const tierId = intent.metadata.tier_id ?? '';
  const userId = intent.metadata.user_id ?? '';
  const quantity = Number(intent.metadata.quantity);
  const unitPriceCents = Number(intent.metadata.unit_price_cents);
  const tagged =
    tierId.length > 0 &&
    userId.length > 0 &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 8 &&
    Number.isInteger(unitPriceCents) &&
    unitPriceCents >= 0;
  if (!tagged) return { kind: 'review', reason: 'incomplete' };
  if (intent.currency.toLowerCase() !== 'usd') return { kind: 'review', reason: 'currency' };
  if (intent.status !== 'succeeded') return { kind: 'review', reason: 'status' };
  if (intent.amount !== unitPriceCents * quantity) return { kind: 'review', reason: 'amount' };
  return { kind: 'issue', tierId, userId, quantity, unitPriceCents, amount: intent.amount };
}

export function decideRefund(charge: ChargeView): RefundDecision {
  if (!charge.paymentIntentId) return 'ignore';
  if (charge.amountRefunded <= 0 && !charge.refunded) return 'ignore';
  if (charge.amount > 0 && (charge.refunded || charge.amountRefunded >= charge.amount)) return 'full';
  return 'partial';
}

export function newCheckoutAttemptId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `attempt-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}
