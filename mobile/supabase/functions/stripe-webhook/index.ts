import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

import { json, requireTestKey, ticketCode } from '../_shared/http.ts';

type TierRow = {
  id: string;
  event_id: string;
  name: string;
  price_cents: number;
};

type EventRow = {
  name: string;
  edition: string;
  long_date_label: string | null;
  time_label: string | null;
};

Deno.serve(async (req) => {
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

  if (event.type !== 'payment_intent.succeeded' && event.type !== 'charge.refunded') {
    return json({ ok: true, ignored: event.type });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const paymentRef = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!paymentRef) {
      return json({ ok: true });
    }
    const { data: order } = await admin.from('orders').select('id').eq('payment_ref', paymentRef).maybeSingle();
    if (!order) {
      return json({ ok: true });
    }
    await admin.from('orders').update({ status: 'refunded' }).eq('id', order.id);
    await admin.from('tickets').update({ status: 'refunded' }).eq('order_id', order.id);
    return json({ ok: true, refunded: true });
  }

  const intent = event.data.object as Stripe.PaymentIntent;
  const tierId = intent.metadata?.tier_id;
  const userId = intent.metadata?.user_id;
  const quantity = Number(intent.metadata?.quantity ?? 0);
  if (!tierId || !userId || !Number.isInteger(quantity) || quantity < 1 || quantity > 8) {
    return json({ error: 'Payment metadata is incomplete.' }, 400);
  }

  const { data: existing } = await admin.from('orders').select('id').eq('payment_ref', intent.id).maybeSingle();
  if (existing) {
    return json({ ok: true, duplicate: true });
  }

  const { data: tier } = await admin
    .from('ticket_tiers')
    .select('id, event_id, name, price_cents')
    .eq('id', tierId)
    .maybeSingle();
  const priced = tier as TierRow | null;
  if (!priced || priced.price_cents == null) {
    return json({ error: 'Tier missing.' }, 400);
  }
  if (intent.amount !== priced.price_cents * quantity) {
    return json({ error: 'Amount mismatch.' }, 400);
  }

  const { data: eventRow } = await admin
    .from('events')
    .select('name, edition, long_date_label, time_label')
    .eq('id', priced.event_id)
    .maybeSingle();
  const evening = eventRow as EventRow | null;
  const { data: profile } = await admin.from('guest_profiles').select('display_name').eq('id', userId).maybeSingle();
  const guestName = profile?.display_name || 'Guest';

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      profile_id: userId,
      event_id: priced.event_id,
      tier_id: priced.id,
      quantity,
      total_cents: priced.price_cents * quantity,
      status: 'paid',
      payment_ref: intent.id,
      sample: false,
    })
    .select('id')
    .single();
  if (orderError) {
    if (orderError.code === '23505') {
      return json({ ok: true, duplicate: true });
    }
    return json({ error: orderError.message }, 500);
  }

  const dated = priced.event_id === 'sunset-social';
  const tickets = Array.from({ length: quantity }, (_, index) => ({
    order_id: order.id,
    event_id: priced.event_id,
    tier_id: priced.id,
    holder_profile_id: userId,
    guest_name: guestName,
    code: ticketCode(),
    status: 'valid',
    ticket_index: index + 1,
    ticket_count: quantity,
    sample: false,
    event_name: evening?.name ?? 'Sunset Social',
    edition: evening?.edition ?? '01',
    tier_name: priced.name,
    doors_label: 'Golden hour',
    date_month: dated ? 'JAN' : null,
    date_day: dated ? '23' : null,
    date_year: dated ? '2027' : null,
    date_weekday: dated ? 'Saturday' : null,
    date_time: evening?.time_label || 'Time TBA',
    event_timing: 'upcoming',
  }));
  const { error: ticketError } = await admin.from('tickets').insert(tickets);
  if (ticketError) {
    return json({ error: ticketError.message }, 500);
  }
  return json({ ok: true });
});
