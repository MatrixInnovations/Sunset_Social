import { cloneOrder, cloneTicket, type SampleDatabase } from '@/data/sampleDatabase';
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
  SocialEvent,
  TicketRecord,
  TicketTier,
  VenueRevealRow,
  Viewer,
  WallGuest,
} from '@/domain/types';
import { CheckoutError } from '@/services/errors';
import type {
  AuthGateway,
  EventReader,
  GuestPort,
  OrderPort,
  PaymentGateway,
  PaymentPresenter,
  TicketPort,
} from '@/services/ports';

export class SampleEventRepository implements EventReader {
  constructor(private readonly db: SampleDatabase) {}

  async listEvents(): Promise<SocialEvent[]> {
    return this.db.events.map((event) => ({ ...event }));
  }

  async getEvent(id: string): Promise<SocialEvent | null> {
    return this.db.events.find((event) => event.id === id) ?? null;
  }

  async listTiers(eventId: string): Promise<TicketTier[]> {
    return this.db.tiers.filter((tier) => tier.eventId === eventId).map((tier) => ({ ...tier }));
  }

  async getTier(id: string): Promise<TicketTier | null> {
    return this.db.tiers.find((tier) => tier.id === id) ?? null;
  }

  async getReveal(eventId: string): Promise<VenueRevealRow | null> {
    return { eventId, venueName: null, address: null, notes: null };
  }
}

export class SampleTicketRepository implements TicketPort {
  constructor(private readonly db: SampleDatabase) {}

  async listForHolder(profileId: string): Promise<TicketRecord[]> {
    return this.db.tickets.filter((row) => row.holderId === profileId && row.id.startsWith('t-new-')).map(cloneTicket);
  }

  async listSamplePreview(): Promise<TicketRecord[]> {
    return this.db.tickets
      .filter((row) => row.holderId === 'sample-guest' && row.status === 'valid')
      .map(cloneTicket);
  }

  async findByCode(code: string): Promise<TicketRecord | null> {
    const found = this.db.tickets.find((row) => row.code === code);
    return found ? cloneTicket(found) : null;
  }

  async guestList(eventId: string): Promise<DoorGuest[]> {
    return this.db.tickets
      .filter((row) => row.eventId === eventId)
      .map((row) => ({
        id: row.id,
        name: row.guestName,
        code: row.code,
        tierName: row.tierName,
        status: row.status,
        sample: row.sample,
      }));
  }

  async doorCounts(eventId: string): Promise<DoorCounts> {
    return this.db.doorCounts(eventId);
  }

  async markCheckedIn(ticketId: string, _staffId: string): Promise<boolean> {
    const row = this.db.tickets.find((item) => item.id === ticketId);
    if (!row || row.status !== 'valid') {
      return false;
    }
    row.status = 'checked_in';
    return true;
  }

  async appendCheckin(entry: CheckinEntry): Promise<void> {
    this.db.checkins.push(entry);
  }

  async remoteScan(): Promise<null | import('@/domain/types').ScanResult> {
    return null;
  }
}

export class SampleOrderRepository implements OrderPort {
  constructor(private readonly db: SampleDatabase) {}

  async createPaid(input: NewPaidOrder): Promise<PlacedOrder> {
    return this.db.createPaid(input);
  }

  async waitForPayment(paymentRef: string): Promise<PlacedOrder | null> {
    const found = this.db.orders.find((order) => order.paymentRef === paymentRef);
    return found ? cloneOrder(found) : null;
  }
}

export class SampleGuestRepository implements GuestPort {
  constructor(private readonly db: SampleDatabase) {}

  async getProfile(id: string): Promise<GuestProfile> {
    const profile = this.db.profiles.find((item) => item.id === id);
    if (!profile) {
      throw new Error('Profile not found.');
    }
    return { ...profile };
  }

  async updateProfile(id: string, patch: ProfilePatch): Promise<GuestProfile> {
    return this.db.updateProfile(id, patch);
  }

  async listWall(_eventId: string): Promise<WallGuest[]> {
    return this.db.wall.map((guest) => ({ ...guest }));
  }

  async wave(fromId: string, toId: string, eventId: string): Promise<boolean> {
    const exists = this.db.waves.some(
      (wave) => wave.fromId === fromId && wave.toId === toId && wave.eventId === eventId,
    );
    if (!exists) {
      this.db.waves.push({ fromId, toId, eventId });
    }
    return true;
  }

  async setFollowing(_profileId: string, following: boolean): Promise<number> {
    this.db.following = following ? 1 : 0;
    this.db.viewerState = { ...this.db.viewerState, followingHost: following };
    return this.db.following;
  }

  async followingCount(): Promise<number> {
    return this.db.following;
  }

  viewer(): Viewer {
    return { ...this.db.viewerState, ticketEventIds: [...this.db.viewerState.ticketEventIds] };
  }

  setViewer(next: Viewer): void {
    this.db.viewerState = { ...next, ticketEventIds: [...next.ticketEventIds] };
  }
}

export class DemoPaymentGateway implements PaymentGateway {
  async createIntent(_input: IntentRequest): Promise<IntentResponse> {
    throw new CheckoutError('Demo checkout does not call Stripe.', 'payment');
  }
}

export class IdlePresenter implements PaymentPresenter {
  async present(): Promise<'completed'> {
    return 'completed';
  }
}

export class DemoAuthGateway implements AuthGateway {
  async sendPhone(): Promise<void> {
    return undefined;
  }

  async verifyPhone(): Promise<void> {
    return undefined;
  }

  async sendEmail(): Promise<void> {
    return undefined;
  }

  async verifyEmail(): Promise<void> {
    return undefined;
  }

  async signOut(): Promise<void> {
    return undefined;
  }

  async deleteAccount(): Promise<void> {
    return undefined;
  }
}
