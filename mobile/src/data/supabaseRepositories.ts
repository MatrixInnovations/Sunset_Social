import type { SupabaseClient } from '@supabase/supabase-js';

import { table, unwrapList, unwrapOne } from '@/data/supabaseApi';
import { mapEventRow, mapTicketRow, mapTierRow } from '@/data/rowMappers';
import type {
  CheckinEntry,
  DoorCounts,
  DoorGuest,
  GuestProfile,
  IntentRequest,
  IntentResponse,
  NewPaidOrder,
  PlacedOrder,
  ProfilePatch,
  ScanResult,
  SocialEvent,
  TicketRecord,
  TicketStatus,
  TicketTier,
  VenueRevealRow,
  Viewer,
  WallGuest,
} from '@/domain/types';
import type { TileName } from '@/theme/tokens';
import { CheckoutError } from '@/services/errors';
import type { AuthGateway, EventReader, GuestPort, OrderPort, PaymentGateway, TicketPort } from '@/services/ports';

const tiles: TileName[] = ['gold', 'rose', 'amber', 'champagne', 'burgundy', 'ivory'];

function asTile(value: unknown): TileName {
  return tiles.includes(value as TileName) ? (value as TileName) : 'gold';
}

function mapProfile(row: Record<string, unknown>): GuestProfile {
  return {
    id: String(row.id ?? ''),
    displayName: String(row.display_name ?? 'Your Name'),
    monogram: String(row.monogram ?? 'Y'),
    bio: String(row.bio ?? ''),
    showPhoto: row.show_photo === true,
    showOnLists: row.show_on_lists === true,
    notifyOnDates: row.notify_on_dates === true,
    tile: asTile(row.tile),
    sample: false,
  };
}

export class SupabaseEventRepository implements EventReader {
  constructor(private readonly client: SupabaseClient) {}

  async listEvents(): Promise<SocialEvent[]> {
    const result = await table(this.client, 'events').select('*').order('sort');
    return unwrapList(result).map(mapEventRow);
  }

  async getEvent(id: string): Promise<SocialEvent | null> {
    const result = await table(this.client, 'events').select('*').eq('id', id).maybeSingle();
    const row = unwrapOne(result);
    return row ? mapEventRow(row) : null;
  }

  async listTiers(eventId: string): Promise<TicketTier[]> {
    const result = await table(this.client, 'ticket_tiers').select('*').eq('event_id', eventId).order('sort');
    return unwrapList(result).map(mapTierRow);
  }

  async getTier(id: string): Promise<TicketTier | null> {
    const result = await table(this.client, 'ticket_tiers').select('*').eq('id', id).maybeSingle();
    const row = unwrapOne(result);
    return row ? mapTierRow(row) : null;
  }

  async getReveal(eventId: string): Promise<VenueRevealRow | null> {
    const result = await table(this.client, 'event_reveals').select('*').eq('event_id', eventId).maybeSingle();
    const row = unwrapOne(result);
    if (!row) {
      return null;
    }
    return {
      eventId,
      venueName: typeof row.venue_name === 'string' ? row.venue_name : null,
      address: typeof row.address === 'string' ? row.address : null,
      notes: typeof row.notes === 'string' ? row.notes : null,
    };
  }
}

export class SupabaseTicketRepository implements TicketPort {
  constructor(private readonly client: SupabaseClient) {}

  async listForHolder(profileId: string): Promise<TicketRecord[]> {
    const result = await table(this.client, 'tickets').select('*').eq('holder_profile_id', profileId);
    return unwrapList(result).map(mapTicketRow);
  }

  async listSamplePreview(): Promise<TicketRecord[]> {
    return [];
  }

  async findByCode(code: string): Promise<TicketRecord | null> {
    const result = await table(this.client, 'tickets').select('*').eq('code', code).maybeSingle();
    const row = unwrapOne(result);
    return row ? mapTicketRow(row) : null;
  }

  async guestList(eventId: string): Promise<DoorGuest[]> {
    const result = await table(this.client, 'tickets').select('*').eq('event_id', eventId);
    return unwrapList(result).map((row) => {
      const ticket = mapTicketRow(row);
      return {
        id: ticket.id,
        name: ticket.guestName,
        code: ticket.code,
        tierName: ticket.tierName,
        status: ticket.status,
        sample: ticket.sample,
      };
    });
  }

  async doorCounts(eventId: string): Promise<DoorCounts> {
    const tickets = unwrapList(await table(this.client, 'tickets').select('status').eq('event_id', eventId));
    const event = unwrapOne(await table(this.client, 'events').select('capacity').eq('id', eventId).maybeSingle());
    const admitted = tickets.filter((row) => row.status === 'checked_in').length;
    const capacity = typeof event?.capacity === 'number' ? event.capacity : Math.max(admitted, 1);
    return { admitted, capacity, pending: 0, sample: false };
  }

  async markCheckedIn(): Promise<boolean> {
    return false;
  }

  async appendCheckin(_entry: CheckinEntry): Promise<void> {
    return undefined;
  }

  async remoteScan(raw: string, eventId: string): Promise<ScanResult | null> {
    const { data, error } = await this.client.functions.invoke('check-in', {
      body: { code: raw, eventId },
    });
    if (error) {
      throw new Error(error.message);
    }
    const body = data as ScanResult;
    return body;
  }
}

export class SupabaseOrderRepository implements OrderPort {
  constructor(private readonly client: SupabaseClient) {}

  async createPaid(_input: NewPaidOrder): Promise<PlacedOrder> {
    throw new CheckoutError('Tickets are issued by the server after payment.', 'payment');
  }

  async waitForPayment(paymentRef: string): Promise<PlacedOrder | null> {
    const orderResult = await table(this.client, 'orders').select('*').eq('payment_ref', paymentRef).maybeSingle();
    const order = unwrapOne(orderResult);
    if (!order) {
      return null;
    }
    const tickets = unwrapList(await table(this.client, 'tickets').select('*').eq('order_id', String(order.id)));
    const mapped = tickets.map(mapTicketRow);
    return {
      id: String(order.id),
      eventId: String(order.event_id),
      tierId: String(order.tier_id),
      quantity: Number(order.quantity),
      totalCents: Number(order.total_cents),
      unitCents: mapped[0]?.total ? Number(order.total_cents) / Number(order.quantity) : Number(order.total_cents),
      status: order.status === 'refunded' ? 'refunded' : 'paid',
      sample: false,
      paymentRef,
      profileId: String(order.profile_id),
      tickets: mapped,
    };
  }

  async listInReview() {
    const orders = unwrapList(
      await table(this.client, 'orders')
        .select('id, event_id, status, review_note, created_at')
        .eq('status', 'review')
        .order('created_at', { ascending: false }),
    );
    const events = unwrapList(await table(this.client, 'events').select('id, name'));
    const names = new Map(events.map((row) => [String(row.id), String(row.name ?? row.id)]));
    return orders.map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id),
      eventName: names.get(String(row.event_id)) ?? String(row.event_id),
      status: 'review' as const,
      reviewNote: row.review_note == null ? '' : String(row.review_note),
      createdAt: String(row.created_at ?? ''),
      sample: false,
    }));
  }
}

export class SupabasePaymentGateway implements PaymentGateway {
  constructor(private readonly client: SupabaseClient) {}

  async createIntent(input: IntentRequest): Promise<IntentResponse> {
    const { data, error } = await this.client.functions.invoke('create-payment-intent', { body: input });
    if (error || !data) {
      throw new CheckoutError(error?.message ?? 'Could not start payment.', 'payment');
    }
    const body = data as IntentResponse;
    if (!body.clientSecret || !body.paymentIntentId) {
      throw new CheckoutError('Payment did not return a client secret.', 'payment');
    }
    return body;
  }
}

export class SupabaseGuestRepository implements GuestPort {
  viewerState: Viewer = {
    id: '',
    demo: false,
    doorStaff: false,
    followingHost: false,
    ticketEventIds: [],
  };

  constructor(private readonly client: SupabaseClient) {}

  async getProfile(id: string): Promise<GuestProfile> {
    const result = await table(this.client, 'guest_profiles').select('*').eq('id', id).maybeSingle();
    const row = unwrapOne(result);
    if (!row) {
      throw new Error('Profile not found.');
    }
    return mapProfile(row);
  }

  async updateProfile(id: string, patch: ProfilePatch): Promise<GuestProfile> {
    const payload: Record<string, unknown> = {};
    if (patch.displayName != null) {
      payload.display_name = patch.displayName;
      payload.monogram = patch.displayName.trim().charAt(0).toUpperCase() || 'Y';
    }
    if (patch.bio != null) payload.bio = patch.bio;
    if (patch.showPhoto != null) payload.show_photo = patch.showPhoto;
    if (patch.showOnLists != null) payload.show_on_lists = patch.showOnLists;
    if (patch.notifyOnDates != null) payload.notify_on_dates = patch.notifyOnDates;
    const result = await table(this.client, 'guest_profiles')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    const row = unwrapOne(result);
    if (!row) {
      return this.getProfile(id);
    }
    return mapProfile(row);
  }

  async listWall(eventId: string): Promise<WallGuest[]> {
    const result = await table(this.client, 'profile_visibility')
      .select('profile_id,tier_name,you_know,guest_profiles(display_name,monogram,bio,show_photo,show_on_lists,notify_on_dates,tile)')
      .eq('event_id', eventId)
      .eq('show_on_wall', true);
    return unwrapList(result).map((row) => {
      const nested = (row.guest_profiles ?? {}) as Record<string, unknown>;
      const profile = mapProfile({ ...nested, id: row.profile_id });
      return {
        ...profile,
        youKnow: row.you_know === true,
        tierName: typeof row.tier_name === 'string' ? row.tier_name : 'Golden Hour',
      };
    });
  }

  async wave(fromId: string, toId: string, eventId: string): Promise<boolean> {
    const result = await table(this.client, 'waves').insert({
      from_profile: fromId,
      to_profile: toId,
      event_id: eventId,
    });
    if (result.error && result.error.code !== '23505') {
      throw new Error(result.error.message);
    }
    return true;
  }

  async setFollowing(profileId: string, following: boolean): Promise<number> {
    await table(this.client, 'guest_profiles').update({ following_host: following }).eq('id', profileId);
    this.viewerState = { ...this.viewerState, followingHost: following };
    return following ? 1 : 0;
  }

  async followingCount(profileId: string): Promise<number> {
    const result = await table(this.client, 'guest_profiles').select('following_host').eq('id', profileId).maybeSingle();
    const row = unwrapOne(result);
    return row?.following_host === true ? 1 : 0;
  }

  viewer(): Viewer {
    return { ...this.viewerState, ticketEventIds: [...this.viewerState.ticketEventIds] };
  }

  setViewer(next: Viewer): void {
    this.viewerState = { ...next, ticketEventIds: [...next.ticketEventIds] };
  }
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async sendPhone(phone: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({ phone });
    if (error) {
      throw new Error(error.message);
    }
  }

  async verifyPhone(phone: string, code: string): Promise<void> {
    const { error } = await this.client.auth.verifyOtp({ phone, token: code, type: 'sms' });
    if (error) {
      throw new Error(error.message);
    }
  }

  async sendEmail(email: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({ email });
    if (error) {
      throw new Error(error.message);
    }
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    const { error } = await this.client.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) {
      throw new Error(error.message);
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.client.functions.invoke('delete-account', { body: {} });
    if (error) {
      throw new Error(error.message);
    }
  }
}

export function isTicketStatus(value: string): value is TicketStatus {
  return value === 'valid' || value === 'checked_in' || value === 'void' || value === 'refunded' || value === 'transferred';
}
