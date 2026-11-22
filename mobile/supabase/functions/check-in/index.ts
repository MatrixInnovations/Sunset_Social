import { createClient } from 'npm:@supabase/supabase-js@2';

import { json } from '../_shared/http.ts';

const PREFIX = 'SUNSETSOCIAL:TICKET:';

type TicketRow = {
  id: string;
  event_id: string;
  status: string;
  guest_name: string;
  tier_name: string;
  code: string;
  ticket_index: number;
  ticket_count: number;
  sample: boolean;
};

function judge(ticket: TicketRow | null, eventId: string): string {
  if (!ticket) return 'unknown';
  if (ticket.event_id !== eventId) return 'wrong_event';
  if (ticket.status === 'refunded') return 'refunded';
  if (ticket.status === 'void' || ticket.status === 'transferred') return 'void';
  if (ticket.status === 'checked_in') return 'duplicate';
  if (ticket.status !== 'valid') return 'void';
  return 'admitted';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
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

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: role } = await admin.from('staff_roles').select('role').eq('profile_id', userData.user.id).maybeSingle();
  if (!role || (role.role !== 'admin' && role.role !== 'door')) {
    return json({ error: 'Door mode is for the host.' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const eventId = String(body.eventId ?? '');
  const raw = String(body.code ?? '').trim();
  const code = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length).trim() : raw;
  if (!eventId || !code) {
    return json({ outcome: 'unknown', guestName: null, tierName: null, code: null, index: null, total: null, sample: false, paidLabel: null });
  }

  const { data: ticketRow } = await admin.from('tickets').select('*').eq('code', code).maybeSingle();
  const ticket = ticketRow as TicketRow | null;
  let outcome = judge(ticket, eventId);
  if (outcome === 'admitted' && ticket) {
    const { data: updated } = await admin
      .from('tickets')
      .update({ status: 'checked_in', checked_in_at: new Date().toISOString(), checked_in_by: userData.user.id })
      .eq('id', ticket.id)
      .eq('status', 'valid')
      .select('id');
    if (!updated || updated.length === 0) {
      outcome = 'duplicate';
    }
  }

  await admin.from('checkins').insert({
    ticket_id: ticket?.id ?? null,
    event_id: eventId,
    scanned_by: userData.user.id,
    code_presented: code,
    result: outcome,
  });

  return json({
    outcome,
    guestName: ticket?.guest_name ?? null,
    tierName: ticket?.tier_name ?? null,
    code: ticket?.code ?? code,
    index: ticket?.ticket_index ?? null,
    total: ticket?.ticket_count ?? null,
    sample: ticket?.sample === true,
    paidLabel: ticket ? (ticket.status === 'refunded' || outcome === 'refunded' ? 'Refunded' : 'Paid') : null,
  });
});
