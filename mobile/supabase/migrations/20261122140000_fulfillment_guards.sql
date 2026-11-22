-- Fulfillment guards. Applied after 20261122120000. Does not rewrite that migration.
-- Orders and tickets are issued in one transaction. Capacity is locked inside it.
-- Deleting an account no longer fails when the person has orders, tickets, or waves.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'refunded', 'canceled', 'review'));

alter table public.orders alter column profile_id drop not null;
alter table public.orders drop constraint if exists orders_profile_id_fkey;
alter table public.orders
  add constraint orders_profile_id_fkey
  foreign key (profile_id) references public.guest_profiles (id) on delete set null;

alter table public.tickets drop constraint if exists tickets_holder_profile_id_fkey;
alter table public.tickets
  add constraint tickets_holder_profile_id_fkey
  foreign key (holder_profile_id) references public.guest_profiles (id) on delete set null;

alter table public.waves drop constraint if exists waves_from_profile_fkey;
alter table public.waves drop constraint if exists waves_to_profile_fkey;
alter table public.waves
  add constraint waves_from_profile_fkey
  foreign key (from_profile) references public.guest_profiles (id) on delete cascade;
alter table public.waves
  add constraint waves_to_profile_fkey
  foreign key (to_profile) references public.guest_profiles (id) on delete cascade;

create table if not exists public.refund_markers (
  payment_ref text primary key,
  amount_refunded integer not null default 0,
  full_refund boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.refund_markers enable row level security;

-- Unused tickets are voided before the profile row disappears, then the FK sets the holder to null.
create or replace function public.void_tickets_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tickets
  set status = 'void'
  where holder_profile_id = old.id
    and status = 'valid';
  return old;
end;
$$;

drop trigger if exists void_tickets_before_profile_delete on public.guest_profiles;
create trigger void_tickets_before_profile_delete
  before delete on public.guest_profiles
  for each row execute function public.void_tickets_before_profile_delete();

create or replace function public.make_ticket_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  out text := 'SS-';
  i integer;
begin
  bytes := extensions.gen_random_bytes(12);
  for i in 0..11 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return out;
end;
$$;

-- One transaction: the order and its tickets commit together, or not at all.
-- A Stripe retry therefore cannot observe an order that has no tickets.
create or replace function public.issue_order(
  p_intent_id text,
  p_user uuid,
  p_tier text,
  p_qty integer,
  p_amount integer,
  p_unit_price integer,
  p_outcome text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_status text;
  v_have integer;
  v_event_id text;
  v_event_name text;
  v_edition text;
  v_time text;
  v_tier_name text;
  v_event_capacity integer;
  v_tier_capacity integer;
  v_sold integer;
  v_tier_sold integer;
  v_guest text;
  v_index integer;
  v_code text;
  v_attempt integer;
  v_inserted boolean;
begin
  if p_outcome not in ('paid', 'review', 'refunded') then
    return jsonb_build_object('ok', false, 'error', 'outcome');
  end if;
  if p_qty < 1 or p_qty > 8 then
    return jsonb_build_object('ok', false, 'error', 'quantity');
  end if;

  select o.id, o.status, (select count(*) from public.tickets tk where tk.order_id = o.id)
    into v_order_id, v_status, v_have
  from public.orders o
  where o.payment_ref = p_intent_id
  for update;

  if v_order_id is not null and (v_have >= p_qty or v_status in ('review', 'refunded', 'canceled')) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'order_id', v_order_id, 'status', v_status);
  end if;

  select t.event_id, t.name, t.capacity, e.capacity, e.name, e.edition, e.time_label
    into v_event_id, v_tier_name, v_tier_capacity, v_event_capacity, v_event_name, v_edition, v_time
  from public.ticket_tiers t
  join public.events e on e.id = t.event_id
  where t.id = p_tier
  for update of e, t;

  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'tier_missing');
  end if;

  select count(*) into v_sold
  from public.tickets
  where event_id = v_event_id and status in ('valid', 'checked_in');

  select count(*) into v_tier_sold
  from public.tickets
  where tier_id = p_tier and status in ('valid', 'checked_in');

  if p_outcome = 'paid' then
    if v_event_capacity is not null and v_sold + (p_qty - coalesce(v_have, 0)) > v_event_capacity then
      if v_order_id is null then
        insert into public.orders (profile_id, event_id, tier_id, quantity, total_cents, status, payment_ref, sample)
        values (p_user, v_event_id, p_tier, p_qty, p_amount, 'review', p_intent_id, false)
        returning id into v_order_id;
      else
        update public.orders set status = 'review' where id = v_order_id;
      end if;
      return jsonb_build_object('ok', true, 'review', true, 'reason', 'capacity', 'order_id', v_order_id);
    end if;
    if v_tier_capacity is not null and v_tier_sold + (p_qty - coalesce(v_have, 0)) > v_tier_capacity then
      if v_order_id is null then
        insert into public.orders (profile_id, event_id, tier_id, quantity, total_cents, status, payment_ref, sample)
        values (p_user, v_event_id, p_tier, p_qty, p_amount, 'review', p_intent_id, false)
        returning id into v_order_id;
      else
        update public.orders set status = 'review' where id = v_order_id;
      end if;
      return jsonb_build_object('ok', true, 'review', true, 'reason', 'tier_capacity', 'order_id', v_order_id);
    end if;
  end if;

  select display_name into v_guest from public.guest_profiles where id = p_user;
  if v_guest is null or length(trim(v_guest)) = 0 then
    v_guest := 'Guest';
  end if;

  if v_order_id is null then
    insert into public.orders (profile_id, event_id, tier_id, quantity, total_cents, status, payment_ref, sample)
    values (
      p_user,
      v_event_id,
      p_tier,
      p_qty,
      p_amount,
      case p_outcome when 'paid' then 'paid' when 'refunded' then 'refunded' else 'review' end,
      p_intent_id,
      false
    )
    returning id into v_order_id;
    v_have := 0;
  end if;

  if p_outcome <> 'paid' then
    return jsonb_build_object('ok', true, 'review', p_outcome = 'review', 'refunded', p_outcome = 'refunded', 'order_id', v_order_id);
  end if;

  for v_index in (coalesce(v_have, 0) + 1)..p_qty loop
    v_inserted := false;
    for v_attempt in 1..5 loop
      begin
        v_code := public.make_ticket_code();
        insert into public.tickets (
          order_id, event_id, tier_id, holder_profile_id, guest_name, code, status,
          ticket_index, ticket_count, sample, event_name, edition, tier_name, doors_label,
          date_month, date_day, date_year, date_weekday, date_time, event_timing
        ) values (
          v_order_id, v_event_id, p_tier, p_user, v_guest, v_code, 'valid',
          v_index, p_qty, false, coalesce(v_event_name, 'Sunset Social'), coalesce(v_edition, '01'), v_tier_name, 'Golden hour',
          case when v_event_id = 'sunset-social' then 'JAN' else null end,
          case when v_event_id = 'sunset-social' then '23' else null end,
          case when v_event_id = 'sunset-social' then '2027' else null end,
          case when v_event_id = 'sunset-social' then 'Saturday' else null end,
          coalesce(nullif(v_time, ''), 'Time TBA'),
          'upcoming'
        );
        v_inserted := true;
        exit;
      exception when unique_violation then
        if v_attempt = 5 then
          raise;
        end if;
      end;
    end loop;
    if not v_inserted then
      raise exception 'ticket code collision';
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'order_id', v_order_id, 'issued', p_qty);
end;
$$;

revoke all on function public.issue_order(text, uuid, text, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.make_ticket_code() from public, anon, authenticated;
grant execute on function public.issue_order(text, uuid, text, integer, integer, integer, text) to service_role;
grant execute on function public.make_ticket_code() to service_role;

-- Guest wall: a row requires a valid ticket, and the server stamps the tier.
create or replace function public.stamp_wall_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tier text;
begin
  select t.tier_name into v_tier
  from public.tickets t
  where t.event_id = new.event_id
    and t.holder_profile_id = new.profile_id
    and t.status in ('valid', 'checked_in')
  order by t.created_at
  limit 1;
  if v_tier is null then
    raise exception 'A valid ticket is required for the guest wall';
  end if;
  new.tier_name := v_tier;
  new.you_know := false;
  return new;
end;
$$;

drop trigger if exists stamp_wall_row on public.profile_visibility;
create trigger stamp_wall_row
  before insert or update on public.profile_visibility
  for each row execute function public.stamp_wall_row();

drop policy if exists visibility_write on public.profile_visibility;
create policy visibility_write on public.profile_visibility
  for all to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.event_id = profile_visibility.event_id
        and t.holder_profile_id = auth.uid()
        and t.status in ('valid', 'checked_in')
    )
  );

drop policy if exists visibility_read on public.profile_visibility;
create policy visibility_read on public.profile_visibility
  for select to authenticated
  using (
    profile_id = auth.uid()
    or (
      show_on_wall = true
      and exists (
        select 1 from public.tickets shown
        where shown.event_id = profile_visibility.event_id
          and shown.holder_profile_id = profile_visibility.profile_id
          and shown.status in ('valid', 'checked_in')
      )
      and exists (
        select 1 from public.tickets reader
        where reader.event_id = profile_visibility.event_id
          and reader.holder_profile_id = auth.uid()
          and reader.status in ('valid', 'checked_in')
      )
    )
  );

drop policy if exists profiles_select_wall on public.guest_profiles;
create policy profiles_select_wall on public.guest_profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.profile_visibility v
      join public.tickets reader on reader.event_id = v.event_id
      join public.tickets shown on shown.event_id = v.event_id and shown.holder_profile_id = guest_profiles.id
      where v.profile_id = guest_profiles.id
        and v.show_on_wall = true
        and reader.holder_profile_id = auth.uid()
        and reader.status in ('valid', 'checked_in')
        and shown.status in ('valid', 'checked_in')
    )
  );

revoke insert (tier_name, you_know), update (tier_name, you_know)
  on public.profile_visibility from anon, authenticated;

-- Default privileges on Supabase grant everything to anon. RLS stays, and the grants are explicit.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.events, public.ticket_tiers to anon, authenticated;
grant select, insert, update on public.guest_profiles to authenticated;
grant select on public.orders, public.tickets, public.checkins, public.event_reveals, public.staff_roles to authenticated;
grant select, insert, update, delete on public.profile_visibility, public.push_tokens to authenticated;
grant select, insert on public.waves to authenticated;
grant all on public.events, public.ticket_tiers, public.guest_profiles, public.orders, public.tickets, public.checkins, public.event_reveals, public.profile_visibility, public.waves, public.staff_roles, public.push_tokens, public.refund_markers to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guest_profiles (id, display_name, monogram)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Your Name'),
    'Y'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
