import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createSampleServices, type AppServices } from '@/bootstrap/createSampleServices';
import { table, unwrapOne } from '@/data/supabaseApi';
import {
  SupabaseAuthGateway,
  SupabaseEventRepository,
  SupabaseGuestRepository,
  SupabaseOrderRepository,
  SupabasePaymentGateway,
  SupabaseTicketRepository,
} from '@/data/supabaseRepositories';
import type { Viewer } from '@/domain/types';
import { readPublishableKey, readSentryDsn, resolveMode, type AppEnv } from '@/lib/env';
import { SentryReporter } from '@/observability/SentryReporter';
import { PlatformPresenter } from '@/payments/presenter';
import { AuthService } from '@/services/AuthService';
import { CheckoutService } from '@/services/CheckoutService';
import { DoorService } from '@/services/DoorService';
import { EventService } from '@/services/EventService';
import { GuestService } from '@/services/GuestService';
import { LaterRelease } from '@/services/LaterRelease';
import { ExpoNotificationGateway, NotificationService } from '@/services/NotificationService';
import { TicketService } from '@/services/TicketService';

export function createSupabase(env: AppEnv = process.env): SupabaseClient | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

export function createAppServices(env: AppEnv = process.env): AppServices {
  const mode = resolveMode(env);
  if (mode === 'demo') {
    return createSampleServices(undefined, { sentryDsn: readSentryDsn(env) });
  }
  const client = createSupabase(env);
  if (!client) {
    return createSampleServices(undefined, { sentryDsn: readSentryDsn(env) });
  }
  return createLiveServices(client, readPublishableKey(env), readSentryDsn(env));
}

export function createLiveServices(client: SupabaseClient, publishableKey: string | null, sentryDsn: string | null): AppServices {
  const events = new SupabaseEventRepository(client);
  const tickets = new SupabaseTicketRepository(client);
  const orders = new SupabaseOrderRepository(client);
  const guestPort = new SupabaseGuestRepository(client);
  const guests = new GuestService(guestPort, tickets);
  return {
    mode: 'live',
    events: new EventService(events),
    tickets: new TicketService(tickets),
    checkout: new CheckoutService(
      events,
      orders,
      new SupabasePaymentGateway(client),
      new PlatformPresenter(),
      'live',
      publishableKey,
    ),
    guests,
    door: new DoorService(tickets, orders, false),
    auth: new AuthService(new SupabaseAuthGateway(client), 'live'),
    notifications: new NotificationService('live', new ExpoNotificationGateway()),
    later: new LaterRelease(),
    sentry: new SentryReporter(sentryDsn),
    refreshViewer: () => hydrateViewer(client, guestPort, tickets),
  };
}

async function hydrateViewer(
  client: SupabaseClient,
  guests: SupabaseGuestRepository,
  tickets: SupabaseTicketRepository,
): Promise<Viewer> {
  const { data } = await client.auth.getUser();
  const userId = data.user?.id;
  if (!userId) {
    const empty: Viewer = { id: '', demo: false, doorStaff: false, followingHost: false, ticketEventIds: [] };
    guests.setViewer(empty);
    return empty;
  }
  const [held, roleRow, profileRow] = await Promise.all([
    tickets.listForHolder(userId),
    table(client, 'staff_roles').select('role').eq('profile_id', userId).maybeSingle(),
    table(client, 'guest_profiles').select('following_host').eq('id', userId).maybeSingle(),
  ]);
  const role = unwrapOne(roleRow);
  const profile = unwrapOne(profileRow);
  const viewer: Viewer = {
    id: userId,
    demo: false,
    doorStaff: role?.role === 'admin' || role?.role === 'door',
    followingHost: profile?.following_host === true,
    ticketEventIds: [...new Set(held.filter((ticket) => ticket.status === 'valid' || ticket.status === 'checked_in').map((ticket) => ticket.eventId))],
  };
  guests.setViewer(viewer);
  return viewer;
}

