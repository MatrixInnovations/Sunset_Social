import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ada = '11111111-1111-4111-8111-111111111111';
const bea = '22222222-2222-4222-8222-222222222222';
const cleo = '33333333-3333-4333-8333-333333333333';

async function asUser(db, userId, run) {
  return db.transaction(async (tx) => {
    await tx.exec(`select set_config('search_path', 'public, auth', true)`);
    await tx.exec(`select set_config('request.jwt.claim.sub', '${userId}', true)`);
    await tx.exec('set local role authenticated');
    return run(tx);
  });
}

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  create schema if not exists auth;
  grant usage on schema auth to anon, authenticated;
  create table if not exists auth.users (
    id uuid primary key,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid
  language sql stable
  as $fn$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;
  create schema if not exists extensions;
  create extension if not exists pgcrypto with schema extensions;
`);

for (const file of ['20261122120000_sunset_social_mvp.sql', '20261122140000_fulfillment_guards.sql']) {
  await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'));
}
await db.exec('alter default privileges in schema public grant all on tables to authenticated');
await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261122160000_wall_rls.sql'), 'utf8'));
await db.exec(`
  create table public.future_probe (id integer);
  insert into auth.users (id, raw_user_meta_data) values
    ('${ada}', '{"display_name":"Ada"}'),
    ('${bea}', '{"display_name":"Bea"}'),
    ('${cleo}', '{"display_name":"Cleo"}');
  insert into public.orders (id, profile_id, event_id, tier_id, quantity, total_cents, status, payment_ref, sample)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${ada}', 'sunset-social', 'golden-hour', 1, 3500, 'paid', 'pi_ada', false),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '${bea}', 'sunset-social', 'golden-hour', 1, 3500, 'paid', 'pi_bea', false);
  insert into public.tickets (
    order_id, event_id, tier_id, holder_profile_id, guest_name, code, status,
    ticket_index, ticket_count, sample, event_name, edition, tier_name, doors_label,
    date_month, date_day, date_year, date_weekday, date_time, event_timing
  ) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sunset-social', 'golden-hour', '${ada}', 'Ada', 'SS-ADA', 'valid', 1, 1, false, 'Sunset Social', '01', 'Golden Hour', 'Golden hour', 'JAN', '23', '2027', 'Saturday', '5:00 to 8:00 PM ET', 'upcoming'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sunset-social', 'golden-hour', '${bea}', 'Bea', 'SS-BEA', 'valid', 1, 1, false, 'Sunset Social', '01', 'Golden Hour', 'Golden hour', 'JAN', '23', '2027', 'Saturday', '5:00 to 8:00 PM ET', 'upcoming');
  insert into public.profile_visibility (profile_id, event_id, show_on_wall)
  values ('${ada}', 'sunset-social', true), ('${bea}', 'sunset-social', true);
`);

const adaProfiles = await asUser(db, ada, (tx) => tx.query('select id from public.guest_profiles'));
const adaWall = await asUser(db, ada, (tx) => tx.query('select profile_id from public.profile_visibility'));
const beaProfiles = await asUser(db, bea, (tx) => tx.query('select id from public.guest_profiles'));
const cleoProfiles = await asUser(db, cleo, (tx) => tx.query('select id from public.guest_profiles'));
const cleoWall = await asUser(db, cleo, (tx) => tx.query('select profile_id from public.profile_visibility'));

await db.exec(`update public.tickets set status = 'refunded' where holder_profile_id = '${bea}'`);
await asUser(db, bea, (tx) => tx.exec(`update public.profile_visibility set show_on_wall = false where profile_id = '${bea}'`));
const hidden = await db.query(`select show_on_wall from public.profile_visibility where profile_id = '${bea}'`);
let reshowError = '';
try {
  await asUser(db, bea, (tx) => tx.exec(`update public.profile_visibility set show_on_wall = true where profile_id = '${bea}'`));
} catch (error) {
  reshowError = error instanceof Error ? error.message : String(error);
}

const missingIssued = await db.query(
  `select public.issue_order('pi_missing', '99999999-9999-4999-8999-999999999999', 'golden-hour', 1, 3500, 3500, 'paid') as issue_order`,
);
const missingOrder = await db.query(`select profile_id, status, review_note from public.orders where payment_ref = 'pi_missing'`);
const missingTickets = await db.query(
  `select count(*)::text as count from public.tickets t join public.orders o on o.id = t.order_id where o.payment_ref = 'pi_missing'`,
);

await db.exec(`insert into public.refund_markers (payment_ref, amount_refunded, full_refund) values ('pi_marked', 3500, true)`);
const marked = await db.query(
  `select public.issue_order('pi_marked', '${ada}', 'golden-hour', 1, 3500, 3500, 'paid') as issue_order`,
);
const markedOrder = await db.query(`
  select o.status, count(t.id)::text as tickets
  from public.orders o
  left join public.tickets t on t.order_id = o.id and t.status in ('valid', 'checked_in')
  where o.payment_ref = 'pi_marked'
  group by o.status
`);

const place = await db.query(`
  select n.nspname as nsp, p.proconfig as config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'holds_valid_ticket'
`);
const anon = await db.query(`select has_function_privilege('anon', 'private.holds_valid_ticket(uuid, text)', 'execute') as ok`);
const signedIn = await db.query(
  `select has_function_privilege('authenticated', 'private.holds_valid_ticket(uuid, text)', 'execute') as ok`,
);
const future = await db.query(`select has_table_privilege('authenticated', 'public.future_probe', 'select') as ok`);

const report = {
  adaProfiles: adaProfiles.rows.map((row) => row.id).sort(),
  adaWall: adaWall.rows.map((row) => row.profile_id).sort(),
  beaProfiles: beaProfiles.rows.map((row) => row.id).sort(),
  cleoProfiles: cleoProfiles.rows.map((row) => row.id).sort(),
  cleoWall: cleoWall.rows.map((row) => row.profile_id),
  hidden: hidden.rows[0]?.show_on_wall,
  reshowError,
  missing: {
    reason: missingIssued.rows[0]?.issue_order?.reason,
    order: missingOrder.rows[0],
    tickets: missingTickets.rows[0]?.count,
  },
  marker: {
    reason: marked.rows[0]?.issue_order?.reason,
    order: markedOrder.rows[0],
  },
  nsp: place.rows[0]?.nsp,
  config: (place.rows[0]?.config ?? []).join(' '),
  anonExecute: anon.rows[0]?.ok,
  authExecute: signedIn.rows[0]?.ok,
  futureSelect: future.rows[0]?.ok,
};

await db.close();
process.stdout.write(`${JSON.stringify(report)}\n`);
