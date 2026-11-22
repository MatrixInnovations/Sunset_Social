import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

import { exceedsCapacity } from '../_shared/fulfillment.ts';
import { json, requireTestKey } from '../_shared/http.ts';

const MAX_TICKETS = 8;

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Sign in required.' }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const quantity = Number(body.quantity);
  const tierId = String(body.tierId ?? '');
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.length > 0 ? body.idempotencyKey : undefined;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS) {
    return json({ error: 'Quantity must be from 1 to 8.' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: tier, error } = await admin
    .from('ticket_tiers')
    .select('id, event_id, name, price_cents, capacity, max_per_order, purchasable')
    .eq('id', tierId)
    .maybeSingle();
  if (error || !tier || !tier.purchasable || tier.price_cents == null) {
    return json({ error: 'That tier is not on sale.' }, 400);
  }
  if (quantity > tier.max_per_order || quantity > MAX_TICKETS) {
    return json({ error: 'Above the per-order limit.' }, 400);
  }

  const { data: evening, error: eventError } = await admin
    .from('events')
    .select('capacity')
    .eq('id', tier.event_id)
    .maybeSingle();
  if (eventError || !evening) {
    return json({ error: 'That evening is not on sale.' }, 400);
  }
  const { count: eventSold, error: eventCountError } = await admin
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', tier.event_id)
    .in('status', ['valid', 'checked_in']);
  const { count: tierSold, error: tierCountError } = await admin
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('tier_id', tier.id)
    .in('status', ['valid', 'checked_in']);
  if (eventCountError || tierCountError) {
    return json({ error: 'Could not check remaining places.' }, 502);
  }
  if (exceedsCapacity(eventSold ?? 0, evening.capacity, quantity) || exceedsCapacity(tierSold ?? 0, tier.capacity, quantity)) {
    return json({ error: 'That evening does not have enough places left.' }, 409);
  }

  const amount = tier.price_cents * quantity;
  const stripe = new Stripe(secret);
  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        description: `Sunset Social · ${tier.name} × ${quantity}`,
        metadata: {
          event_id: tier.event_id,
          tier_id: tier.id,
          quantity: String(quantity),
          unit_price_cents: String(tier.price_cents),
          user_id: userData.user.id,
          app: 'sunset-social',
          mode: 'test',
        },
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
    return json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount,
      currency: 'usd',
    });
  } catch (stripeError) {
    const message = stripeError instanceof Error ? stripeError.message : 'Stripe could not start the payment.';
    return json({ error: message }, 502);
  }
});
