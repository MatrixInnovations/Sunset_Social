-- Guest-wall reads and a few fulfillment races. Applied after 20261122140000.
-- events.id is text, so holds_valid_ticket takes event_id text (not uuid).
-- The function lives in schema private so PostgREST does not expose it as an RPC.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.holds_valid_ticket(profile_id uuid, event_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tickets as t
    where t.holder_profile_id = holds_valid_ticket.profile_id
      and t.event_id = holds_valid_ticket.event_id
      and t.status in ('valid', 'checked_in')
  );
$$;

revoke all on function private.holds_valid_ticket(uuid, text) from public, anon;
grant execute on function private.holds_valid_ticket(uuid, text) to authenticated;

alter table public.orders add column if not exists review_note text;

-- Refund marker and the missing-profile case are decided in the same transaction
-- as the order insert. A concurrent charge.refunded takes the same advisory lock.
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
  v_full boolean;
  v_from_marker boolean := false;
  v_has_profile boolean;
begin
  if p_outcome not in ('paid', 'review', 'refunded') then
    return jsonb_build_object('ok', false, 'error', 'outcome');
  end if;
  if p_qty < 1 or p_qty > 8 then
    return jsonb_build_object('ok', false, 'error', 'quantity');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_intent_id, 0));

  select o.id, o.status, (select count(*) from public.tickets tk where tk.order_id = o.id)
    into v_order_id, v_status, v_have
  from public.orders o
  where o.payment_ref = p_intent_id
  for update;

  select m.full_refund into v_full
  from public.refund_markers m
  where m.payment_ref = p_intent_id
  for update;
  if found then
    v_from_marker := true;
    if v_full then
      p_outcome := 'refunded';
    elsif p_outcome = 'paid' then
      p_outcome := 'review';
    end if;
  end if;

  if v_order_id is not null and p_outcome = 'refunded' then
    update public.orders set status = 'refunded', review_note = coalesce(review_note, 'refund_marker') where id = v_order_id;
    update public.tickets
      set status = 'refunded'
      where order_id = v_order_id and status in ('valid', 'checked_in');
    return jsonb_build_object('ok', true, 'refunded', true, 'reason', 'refund_marker', 'order_id', v_order_id);
  end if;

  if v_order_id is not null and p_outcome = 'paid' and (v_have >= p_qty or v_status in ('review', 'refunded', 'canceled')) then
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

  select exists (select 1 from public.guest_profiles where id = p_user) into v_has_profile;
  if not v_has_profile then
    if v_order_id is null then
      insert into public.orders (profile_id, event_id, tier_id, quantity, total_cents, status, payment_ref, sample, review_note)
      values (
        null,
        v_event_id,
        p_tier,
        p_qty,
        p_amount,
        case when p_outcome = 'refunded' then 'refunded' else 'review' end,
        p_intent_id,
        false,
        'missing_profile'
      )
      returning id into v_order_id;
    else
      update public.orders
      set status = case when p_outcome = 'refunded' then 'refunded' else 'review' end,
          profile_id = null,
          review_note = 'missing_profile'
      where id = v_order_id;
    end if;
    return jsonb_build_object(
      'ok', true,
      'review', true,
      'reason', case when p_outcome = 'refunded' then 'refunded_missing_profile' else 'missing_profile' end,
      'order_id', v_order_id
    );
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
        insert into public.orders (profile_id, event_id, tier_id, quantity, total_cents, status, payment_ref, sample, review_note)
        values (p_user, v_event_id, p_tier, p_qty, p_amount, 'review', p_intent_id, false, 'capacity')
        returning id into v_order_id;
      else
        update public.orders set status = 'review', review_note = 'capacity' where id = v_order_id;
      end if;
      return jsonb_build_object('ok', true, 'review', true, 'reason', 'capacity', 'order_id', v_order_id);
    end if;
    if v_tier_capacity is not null and v_tier_sold + (p_qty - coalesce(v_have, 0)) > v_tier_capacity then
      if v_order_id is null then
        insert into public.orders (profile_id, event_id, tier_id, quantity, total_cents, status, payment_ref, sample, review_note)
        values (p_user, v_event_id, p_tier, p_qty, p_amount, 'review', p_intent_id, false, 'tier_capacity')
        returning id into v_order_id;
      else
        update public.orders set status = 'review', review_note = 'tier_capacity' where id = v_order_id;
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
    return jsonb_build_object(
      'ok', true,
      'review', p_outcome = 'review',
      'refunded', p_outcome = 'refunded',
      'reason', case when v_from_marker then 'refund_marker' else null end,
      'order_id', v_order_id
    );
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
          coalesce(nullif(v_time, ''), '5:00 to 8:00 PM ET'),
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
grant execute on function public.issue_order(text, uuid, text, integer, integer, integer, text) to service_role;

create or replace function public.record_refund(
  p_intent_id text,
  p_amount integer,
  p_full boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_intent_id, 0));
  insert into public.refund_markers (payment_ref, amount_refunded, full_refund)
  values (p_intent_id, coalesce(p_amount, 0), p_full)
  on conflict (payment_ref) do update
    set amount_refunded = excluded.amount_refunded,
        full_refund = excluded.full_refund;
  select id into v_order from public.orders where payment_ref = p_intent_id for update;
  if v_order is null then
    return jsonb_build_object('ok', true, 'marked', true, 'refunded', p_full);
  end if;
  if p_full then
    update public.orders set status = 'refunded' where id = v_order;
    update public.tickets
      set status = 'refunded'
      where order_id = v_order and status in ('valid', 'checked_in');
    return jsonb_build_object('ok', true, 'refunded', true, 'order_id', v_order);
  end if;
  update public.orders set status = 'review', review_note = 'partial_refund' where id = v_order;
  return jsonb_build_object('ok', true, 'review', true, 'reason', 'partial_refund', 'order_id', v_order);
end;
$$;

revoke all on function public.record_refund(text, integer, boolean) from public, anon, authenticated;
grant execute on function public.record_refund(text, integer, boolean) to service_role;

-- A refunded guest can hide themselves. Showing the row still requires a live ticket.
-- tier_name and you_know stay server-owned. The column revoke in the previous
-- migration is a no-op: that file later grants the whole profile_visibility table.
-- This migration does not repeat it. The trigger is the enforcement.
create or replace function public.stamp_wall_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tier text;
begin
  if tg_op = 'UPDATE' and new.show_on_wall = false then
    new.profile_id := old.profile_id;
    new.event_id := old.event_id;
    new.tier_name := old.tier_name;
    new.you_know := false;
    new.show_photo := old.show_photo;
    return new;
  end if;

  if not private.holds_valid_ticket(new.profile_id, new.event_id) then
    raise exception 'A valid ticket is required for the guest wall';
  end if;

  select t.tier_name into v_tier
  from public.tickets t
  where t.event_id = new.event_id
    and t.holder_profile_id = new.profile_id
    and t.status in ('valid', 'checked_in')
  order by t.created_at
  limit 1;
  new.tier_name := v_tier;
  new.you_know := false;
  return new;
end;
$$;

drop policy if exists visibility_write on public.profile_visibility;
create policy visibility_insert on public.profile_visibility
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and private.holds_valid_ticket(auth.uid(), event_id)
  );

create policy visibility_update on public.profile_visibility
  for update to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and (
      show_on_wall = false
      or private.holds_valid_ticket(auth.uid(), event_id)
    )
  );

create policy visibility_delete on public.profile_visibility
  for delete to authenticated
  using (profile_id = auth.uid());

drop policy if exists visibility_read on public.profile_visibility;
create policy visibility_read on public.profile_visibility
  for select to authenticated
  using (
    profile_id = auth.uid()
    or (
      show_on_wall = true
      and private.holds_valid_ticket(profile_id, event_id)
      and private.holds_valid_ticket(auth.uid(), event_id)
    )
  );

drop policy if exists profiles_select_wall on public.guest_profiles;
create policy profiles_select_wall on public.guest_profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.profile_visibility as v
      where v.profile_id = guest_profiles.id
        and v.show_on_wall = true
        and private.holds_valid_ticket(guest_profiles.id, v.event_id)
        and private.holds_valid_ticket(auth.uid(), v.event_id)
    )
  );

alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from public, anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from public, anon, authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on functions from public, anon, authenticated';
  end if;
end $$;
