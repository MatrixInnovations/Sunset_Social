-- Sunset Social MVP. Venue rows stay empty on purpose: the address is never public.
-- Phase 2 tables (promo codes, transfers, waitlist claims, ambassador links) are not created here.

create extension if not exists pgcrypto;

create table public.events (
  id text primary key,
  edition text not null,
  series_label text not null,
  edition_label text not null,
  name text not null,
  italic_tail text,
  tagline text not null,
  date_label text not null,
  long_date_label text,
  starts_at timestamptz,
  time_label text not null default '',
  price_from_cents integer,
  hero text not null check (hero in ('toast', 'tasting')),
  status text not null check (status in ('announced', 'on_sale', 'past')),
  age_note text,
  venue_public_label text not null,
  card_detail text not null,
  capacity integer,
  host_name text not null,
  host_line text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.ticket_tiers (
  id text primary key,
  event_id text not null references public.events (id),
  name text not null,
  description text not null default '',
  price_cents integer,
  capacity integer,
  max_per_order integer not null default 8 check (max_per_order between 1 and 8),
  purchasable boolean not null default false,
  requires_approval boolean not null default false,
  transferable boolean not null default false,
  sort integer not null default 0
);

create table public.guest_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Your Name',
  monogram text not null default 'Y',
  bio text not null default '' check (char_length(bio) <= 160),
  show_photo boolean not null default false,
  show_on_lists boolean not null default false,
  notify_on_dates boolean not null default false,
  following_host boolean not null default false,
  tile text not null default 'gold',
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.guest_profiles (id),
  event_id text not null references public.events (id),
  tier_id text not null references public.ticket_tiers (id),
  quantity integer not null check (quantity between 1 and 8),
  total_cents integer not null check (total_cents >= 0),
  status text not null check (status in ('pending', 'paid', 'refunded', 'canceled')),
  payment_ref text unique,
  sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  event_id text not null references public.events (id),
  tier_id text not null references public.ticket_tiers (id),
  holder_profile_id uuid references public.guest_profiles (id),
  guest_name text not null,
  code text not null unique,
  status text not null check (status in ('valid', 'checked_in', 'void', 'refunded', 'transferred')),
  ticket_index integer not null,
  ticket_count integer not null,
  sample boolean not null default false,
  event_name text not null,
  edition text not null,
  tier_name text not null,
  doors_label text not null default 'Golden hour',
  date_month text,
  date_day text,
  date_year text,
  date_weekday text,
  date_time text,
  event_timing text not null default 'upcoming' check (event_timing in ('upcoming', 'past')),
  checked_in_at timestamptz,
  checked_in_by uuid,
  created_at timestamptz not null default now()
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets (id),
  event_id text not null references public.events (id),
  scanned_by uuid,
  code_presented text not null,
  result text not null check (result in ('admitted', 'duplicate', 'void', 'refunded', 'unknown', 'wrong_event')),
  created_at timestamptz not null default now()
);

create table public.event_reveals (
  event_id text primary key references public.events (id),
  venue_name text,
  address text,
  notes text
);

create table public.profile_visibility (
  profile_id uuid not null references public.guest_profiles (id) on delete cascade,
  event_id text not null references public.events (id),
  show_on_wall boolean not null default false,
  show_photo boolean not null default false,
  tier_name text,
  you_know boolean not null default false,
  primary key (profile_id, event_id)
);

create table public.waves (
  id uuid primary key default gen_random_uuid(),
  from_profile uuid not null references public.guest_profiles (id),
  to_profile uuid not null references public.guest_profiles (id),
  event_id text not null references public.events (id),
  created_at timestamptz not null default now(),
  unique (from_profile, to_profile, event_id)
);

create table public.staff_roles (
  profile_id uuid primary key references public.guest_profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'door'))
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.guest_profiles (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  unique (profile_id, token)
);

create index tickets_holder_idx on public.tickets (holder_profile_id);
create index tickets_event_idx on public.tickets (event_id);
create index tickets_code_idx on public.tickets (code);
create index orders_profile_idx on public.orders (profile_id);

alter table public.events enable row level security;
alter table public.ticket_tiers enable row level security;
alter table public.guest_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;
alter table public.checkins enable row level security;
alter table public.event_reveals enable row level security;
alter table public.profile_visibility enable row level security;
alter table public.waves enable row level security;
alter table public.staff_roles enable row level security;
alter table public.push_tokens enable row level security;

create policy events_read on public.events
  for select to anon, authenticated
  using (status in ('announced', 'on_sale', 'past'));

create policy tiers_read on public.ticket_tiers
  for select to anon, authenticated
  using (true);

create policy profiles_select_own on public.guest_profiles
  for select to authenticated
  using (auth.uid() = id);

create policy profiles_select_wall on public.guest_profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.profile_visibility v
      join public.tickets t on t.event_id = v.event_id
      where v.profile_id = guest_profiles.id
        and v.show_on_wall = true
        and t.holder_profile_id = auth.uid()
        and t.status in ('valid', 'checked_in')
    )
  );

create policy profiles_insert_own on public.guest_profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own on public.guest_profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy orders_select_own on public.orders
  for select to authenticated
  using (profile_id = auth.uid());

create policy tickets_select_own on public.tickets
  for select to authenticated
  using (holder_profile_id = auth.uid());

create policy tickets_select_staff on public.tickets
  for select to authenticated
  using (
    exists (
      select 1 from public.staff_roles s
      where s.profile_id = auth.uid() and s.role in ('admin', 'door')
    )
  );

create policy checkins_select_staff on public.checkins
  for select to authenticated
  using (
    exists (
      select 1 from public.staff_roles s
      where s.profile_id = auth.uid() and s.role in ('admin', 'door')
    )
  );

create policy reveals_holders on public.event_reveals
  for select to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.event_id = event_reveals.event_id
        and t.holder_profile_id = auth.uid()
        and t.status in ('valid', 'checked_in')
    )
  );

create policy visibility_read on public.profile_visibility
  for select to authenticated
  using (
    profile_id = auth.uid()
    or (
      show_on_wall = true and exists (
        select 1 from public.tickets t
        where t.event_id = profile_visibility.event_id
          and t.holder_profile_id = auth.uid()
          and t.status in ('valid', 'checked_in')
      )
    )
  );

create policy visibility_write on public.profile_visibility
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy waves_read on public.waves
  for select to authenticated
  using (from_profile = auth.uid() or to_profile = auth.uid());

create policy waves_insert on public.waves
  for insert to authenticated
  with check (from_profile = auth.uid());

create policy staff_read_own on public.staff_roles
  for select to authenticated
  using (profile_id = auth.uid());

create policy tokens_own on public.push_tokens
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select on public.events, public.ticket_tiers to anon, authenticated;
grant select, insert, update on public.guest_profiles to authenticated;
grant select on public.orders, public.tickets, public.checkins, public.event_reveals, public.staff_roles to authenticated;
grant select, insert, update, delete on public.profile_visibility, public.push_tokens to authenticated;
grant select, insert on public.waves to authenticated;
grant all on public.events, public.ticket_tiers, public.guest_profiles, public.orders, public.tickets, public.checkins, public.event_reveals, public.profile_visibility, public.waves, public.staff_roles, public.push_tokens to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.events (
  id, edition, series_label, edition_label, name, italic_tail, tagline, date_label, long_date_label,
  starts_at, time_label, price_from_cents, hero, status, age_note, venue_public_label, card_detail,
  capacity, host_name, host_line, sort
) values
  (
    'sunset-social', '01', 'EVENT I · ROOFTOP SOCIAL', 'EDITION NO. 01', 'Sunset Social', 'Social',
    'A premium recurring penthouse social experience at golden hour.',
    'Sat, Jan 23, 2027', 'Saturday, January 23, 2027',
    null, 'Time TBA', 3500, 'toast', 'on_sale', '21+',
    'Rooftop venue to be announced', 'Sat, Jan 23, 2027',
    60, 'Andrew Lowery', 'Sunset Social · The Tasting Room', 1
  ),
  (
    'tasting-room', '02', 'EVENT II', 'THE TASTING ROOM', 'The Tasting Room', null,
    'The second evening. The date is still open.',
    'Jan 2027', null,
    null, '', null, 'tasting', 'announced', '21+',
    'Rooftop venue to be announced', 'Jan 2027 · 21+',
    null, 'Andrew Lowery', 'Sunset Social · The Tasting Room', 2
  );

insert into public.ticket_tiers (id, event_id, name, description, price_cents, max_per_order, purchasable, sort)
values
  ('golden-hour', 'sunset-social', 'Golden Hour', 'Admission · welcome pour on arrival', 3500, 8, true, 1),
  ('tasting-flight', 'sunset-social', 'The Tasting Flight', 'Tier name & price set by host', null, 8, false, 2),
  ('velvet-lounge', 'sunset-social', 'Velvet Lounge', 'Tier name & price set by host', null, 8, false, 3);

insert into public.event_reveals (event_id, venue_name, address, notes)
values
  ('sunset-social', null, null, 'Shared with ticket holders closer to the evening.'),
  ('tasting-room', null, null, 'Shared with ticket holders closer to the evening.');

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.tickets';
    execute 'alter publication supabase_realtime add table public.checkins';
  end if;
end $$;
