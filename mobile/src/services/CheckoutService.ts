import { newCheckoutAttemptId } from '../../supabase/functions/_shared/fulfillment';
import { copy, MAX_TICKETS_PER_ORDER } from '@/domain/copy';
import type { PlaceInput, PlacedOrder, Quote, TicketRecord, TicketTier } from '@/domain/types';
import { CheckoutError } from '@/services/errors';
import type { EventReader, OrderPort, PaymentGateway, PaymentPresenter } from '@/services/ports';

export class CheckoutService {
  static readonly MAX_PER_ORDER = MAX_TICKETS_PER_ORDER;

  constructor(
    private readonly catalog: EventReader,
    private readonly orders: OrderPort,
    private readonly payments: PaymentGateway,
    private readonly presenter: PaymentPresenter,
    private readonly mode: 'demo' | 'live',
    private readonly publishableKey: string | null,
  ) {}

  quote(tier: TicketTier, quantity: number): Quote {
    const qty = this.assertQuantity(quantity, tier);
    if (!tier.purchasable || tier.priceCents == null) {
      throw new CheckoutError('That tier is not on sale yet.', 'tier');
    }
    return {
      quantity: qty,
      unitCents: tier.priceCents,
      totalCents: tier.priceCents * qty,
      tierName: tier.name,
      eventId: tier.eventId,
    };
  }

  async place(input: PlaceInput): Promise<PlacedOrder> {
    this.assertTestKey();
    const tier = await this.catalog.getTier(input.tierId);
    if (!tier) {
      throw new CheckoutError('That tier was not found.', 'tier');
    }
    const quote = this.quote(tier, input.quantity);
    if (input.guestName.trim().length === 0) {
      throw new CheckoutError('Add the name for the ticket.', 'tier');
    }
    const attemptKey = input.idempotencyKey && input.idempotencyKey.length > 0 ? input.idempotencyKey : newCheckoutAttemptId();
    if (this.mode === 'demo') {
      const order = await this.orders.createPaid({
        ...input,
        ...quote,
        guestName: input.guestName.trim(),
        sample: true,
        paymentRef: attemptKey,
      });
      if (order.tickets[0]) {
        return order;
      }
      return { ...order, sample: true, tickets: [demoSampleTicket(input, quote, attemptKey)] };
    }
    const intent = await this.payments.createIntent({
      tierId: tier.id,
      quantity: quote.quantity,
      idempotencyKey: attemptKey,
    });
    if (intent.amount !== quote.totalCents) {
      throw new CheckoutError('The charge does not match the ticket price.', 'payment');
    }
    const presented = await this.presenter.present(intent.clientSecret);
    if (presented === 'canceled') {
      throw new CheckoutError('Payment canceled.', 'payment');
    }
    if (presented !== 'completed') {
      throw new CheckoutError('Payment did not complete.', 'payment');
    }
    const order = await this.orders.waitForPayment(intent.paymentIntentId);
    if (!order) {
      throw new CheckoutError('Payment received. The ticket is still being issued.', 'payment');
    }
    return order;
  }

  private assertQuantity(quantity: number, tier: TicketTier): number {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new CheckoutError('Choose at least one ticket.', 'quantity');
    }
    const cap = Math.min(CheckoutService.MAX_PER_ORDER, tier.maxPerOrder);
    if (quantity > cap) {
      throw new CheckoutError(`Max ${cap} tickets per order.`, 'quantity');
    }
    return quantity;
  }

  private assertTestKey(): void {
    if (this.publishableKey?.startsWith('pk_live_')) {
      throw new CheckoutError('Live Stripe keys are refused. Test mode only.', 'live_key');
    }
    if (this.mode === 'live') {
      if (!this.publishableKey || !this.publishableKey.startsWith('pk_test_')) {
        throw new CheckoutError('A Stripe test publishable key is required.', 'live_key');
      }
    }
  }
}

function demoSampleTicket(input: PlaceInput, quote: Quote, paymentRef: string): TicketRecord {
  return {
    id: `sample-${paymentRef}`,
    orderId: `o-${paymentRef}`,
    eventId: quote.eventId,
    eventName: 'Sunset Social',
    edition: '01',
    tierId: input.tierId,
    tierName: quote.tierName,
    holderId: input.profileId,
    guestName: input.guestName.trim(),
    code: 'SAMPLE-SS01-0001',
    status: 'valid',
    index: 1,
    total: quote.quantity,
    sample: true,
    eventTiming: 'upcoming',
    doorsLabel: copy.doors,
    venueLabel: copy.venueHolders,
    date:
      quote.eventId === 'sunset-social'
        ? {
            month: copy.firstEveningMonth,
            day: copy.firstEveningDay,
            year: copy.firstEveningYear,
            weekday: copy.firstEveningWeekday,
            time: copy.timeTba,
          }
        : null,
  };
}
