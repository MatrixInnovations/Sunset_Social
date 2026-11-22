import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

import { decideRefund, decideSucceeded, type IntentView } from '../_shared/fulfillment.ts';
import { json, requireTestKey } from '../_shared/http.ts';

type IssueResult = {
  ok?: boolean;
  duplicate?: boolean;
  review?: boolean;
  reason?: string;
  order_id?: string;
  error?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const secret = requireTestKey();
  if (secret instanceof Response) {
    return secret;
  }
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  if (!webhookSecret) {
    return json({ error: 'Missing webhook secret.' }, 500);
  }

  const stripe = new Stripe(secret);
  const signature = req.headers.get('stripe-signature') ?? '';
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return json({ error: 'Invalid signature.' }, 400);
  }

  if (event.livemode) {
    return json({ ok: true, ignored: 'livemode' });
  }
  if (event.type !== 'payment_intent.succeeded' && event.type !== 'charge.refunded') {
    return json({ ok: true, ignored: event.type });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const paymentRef = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? null;
    const decision = decideRefund({
      amount: charge.amount,
      amountRefunded: charge.amount_refunded,
      paymentIntentId: paymentRef,
      refunded: charge.refunded,
    });
    if (decision === 'ignore' || !paymentRef) {
      return json({ ok: true, ignored: 'refund' });
    }
    const full = decision === 'full';
    await admin.from('refund_markers').upsert({
      payment_ref: paymentRef,
      amount_refunded: charge.amount_refunded,
      full_refund: full,
    });
    const { data: order } = await admin.from('orders').select('id').eq('payment_ref', paymentRef).maybeSingle();
    if (!order) {
      return json({ ok: true, marked: true, refunded: full });
    }
    if (full) {
      await admin.from('orders').update({ status: 'refunded' }).eq('id', order.id);
      await admin.from('tickets').update({ status: 'refunded' }).eq('order_id', order.id).in('status', ['valid', 'checked_in']);
      return json({ ok: true, refunded: true });
    }
    await admin.from('orders').update({ status: 'review' }).eq('id', order.id);
    return json({ ok: true, review: 'partial_refund' });
  }

  const intent = event.data.object as Stripe.PaymentIntent;
  const decision = decideSucceeded(toIntentView(intent));
  if (decision.kind === 'ignore') {
    return json({ ok: true, ignored: decision.reason });
  }

  const { data: marker } = await admin.from('refund_markers').select('full_refund').eq('payment_ref', intent.id).maybeSingle();
  let outcome: 'paid' | 'review' | 'refunded' = decision.kind === 'review' ? 'review' : 'paid';
  if (marker) {
    outcome = marker.full_refund ? 'refunded' : 'review';
  }
  if (outcome === 'paid') {
    try {
      const fresh = await stripe.paymentIntents.retrieve(intent.id, { expand: ['latest_charge'] });
      const charge = fresh.latest_charge;
      if (charge && typeof charge === 'object') {
        const refund = decideRefund({
          amount: charge.amount,
          amountRefunded: charge.amount_refunded,
          paymentIntentId: intent.id,
          refunded: charge.refunded,
        });
        if (refund === 'full') outcome = 'refunded';
        if (refund === 'partial') outcome = 'review';
      }
    } catch {
      // The success event itself is enough to issue. A retrieve failure must not 500.
    }
  }

  const tierId = decision.kind === 'issue' ? decision.tierId : intent.metadata?.tier_id ?? '';
  const userId = decision.kind === 'issue' ? decision.userId : intent.metadata?.user_id ?? '';
  const quantity = decision.kind === 'issue' ? decision.quantity : Number(intent.metadata?.quantity ?? 1);
  const unitPrice = decision.kind === 'issue' ? decision.unitPriceCents : Number(intent.metadata?.unit_price_cents ?? 0);
  const amount = decision.kind === 'issue' ? decision.amount : intent.amount;

  if (!tierId || !userId) {
    return json({ ok: true, review: 'incomplete' });
  }

  const { data, error } = await admin.rpc('issue_order', {
    p_intent_id: intent.id,
    p_user: userId,
    p_tier: tierId,
    p_qty: Number.isInteger(quantity) && quantity >= 1 ? quantity : 1,
    p_amount: amount,
    p_unit_price: Number.isInteger(unitPrice) ? unitPrice : 0,
    p_outcome: outcome,
  });
  if (error) {
    // The function rolls back as a whole, so a retry is safe.
    return json({ error: error.message }, 500);
  }
  const result = (data ?? {}) as IssueResult;
  if (result.reason === 'capacity' || result.reason === 'tier_capacity') {
    try {
      await stripe.refunds.create({ payment_intent: intent.id });
    } catch {
      // The order is already marked review and has no tickets. Stripe must not retry.
    }
    return json({ ok: true, review: result.reason });
  }
  if (decision.kind === 'review' || result.review) {
    return json({ ok: true, review: decision.kind === 'review' ? decision.reason : result.reason ?? 'review' });
  }
  return json({ ok: true, duplicate: result.duplicate === true, order_id: result.order_id });
});

function toIntentView(intent: Stripe.PaymentIntent): IntentView {
  return {
    id: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
    livemode: intent.livemode,
    metadata: intent.metadata ?? {},
  };
}
