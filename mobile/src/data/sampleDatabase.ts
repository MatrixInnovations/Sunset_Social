import { copy, FIRST_TICKET_CENTS, MAX_TICKETS_PER_ORDER } from '@/domain/copy';
import type {
  CheckinEntry,
  DoorCounts,
  GuestProfile,
  NewPaidOrder,
  PlacedOrder,
  ProfilePatch,
  SocialEvent,
  TicketRecord,
  TicketTier,
  Viewer,
  WallGuest,
} from '@/domain/types';
import type { TileName } from '@/theme/tokens';

export const IDS = {
  sunset: 'sunset-social',
  tasting: 'tasting-room',
  golden: 'golden-hour',
  flight: 'tasting-flight',
  velvet: 'velvet-lounge',
  you: 'sample-you',
  sampleGuest: 'sample-guest',
} as const;

const sunsetDate = {
  month: copy.firstEveningMonth,
  day: copy.firstEveningDay,
  year: copy.firstEveningYear,
  weekday: copy.firstEveningWeekday,
  time: copy.timeTba,
};

function ticket(partial: TicketRecord): TicketRecord {
  return partial;
}

export class SampleDatabase {
  readonly events: SocialEvent[];
  readonly tiers: TicketTier[];
  profiles: GuestProfile[];
  wall: WallGuest[];
  tickets: TicketRecord[];
  orders: PlacedOrder[] = [];
  waves: { fromId: string; toId: string; eventId: string }[] = [];
  checkins: CheckinEntry[] = [];
  viewerState: Viewer;
  following = 1;
  private serial = 100;

  constructor() {
    this.events = [
      {
        id: IDS.sunset,
        edition: '01',
        seriesLabel: 'EVENT I · ROOFTOP SOCIAL',
        editionLabel: 'EDITION NO. 01',
        name: 'Sunset Social',
        italicTail: 'Social',
        tagline: copy.eventTagline,
        shortWhen: copy.firstEveningShort,
        longWhen: copy.firstEveningLong,
        timeLabel: copy.timeTba,
        hasDate: true,
        priceFromCents: FIRST_TICKET_CENTS,
        hero: 'toast',
        status: 'on_sale',
        ageNote: copy.age,
        venuePublicLabel: copy.venuePublic,
        cardDetail: copy.firstEveningShort,
        capacity: 60,
        hostName: copy.hostName,
        hostLine: copy.hostLine,
      },
      {
        id: IDS.tasting,
        edition: '02',
        seriesLabel: 'EVENT II',
        editionLabel: 'THE TASTING ROOM',
        name: 'The Tasting Room',
        italicTail: null,
        tagline: 'The second evening. The date is still open.',
        shortWhen: copy.tastingWhen,
        longWhen: null,
        timeLabel: '',
        hasDate: false,
        priceFromCents: null,
        hero: 'tasting',
        status: 'announced',
        ageNote: copy.age,
        venuePublicLabel: copy.venuePublic,
        cardDetail: `${copy.tastingWhen} · ${copy.age}`,
        capacity: null,
        hostName: copy.hostName,
        hostLine: copy.hostLine,
      },
    ];

    this.tiers = [
      {
        id: IDS.golden,
        eventId: IDS.sunset,
        name: 'Golden Hour',
        description: copy.goldenHourDetail,
        priceCents: FIRST_TICKET_CENTS,
        maxPerOrder: MAX_TICKETS_PER_ORDER,
        purchasable: true,
        sort: 1,
      },
      {
        id: IDS.flight,
        eventId: IDS.sunset,
        name: 'The Tasting Flight',
        description: copy.tierHost,
        priceCents: null,
        maxPerOrder: MAX_TICKETS_PER_ORDER,
        purchasable: false,
        sort: 2,
      },
      {
        id: IDS.velvet,
        eventId: IDS.sunset,
        name: 'Velvet Lounge',
        description: copy.tierHost,
        priceCents: null,
        maxPerOrder: MAX_TICKETS_PER_ORDER,
        purchasable: false,
        sort: 3,
      },
    ];

    this.profiles = [
      this.profile(IDS.you, 'Your Name', 'Y', '', true, true, true, 'gold', true),
      this.profile(IDS.sampleGuest, 'Sample Guest', 'S', 'Sample guest on the golden ticket.', false, false, false, 'gold', true),
    ];

    this.wall = [
      this.guest('maya', 'Maya R.', 'M', 'Here for the sunset and the conversation.', 'gold', true),
      this.guest('jordan', 'Jordan T.', 'J', 'Wine curious. Always up for a toast.', 'rose', true),
      this.guest('dana', 'Dana K.', 'D', 'First Sunset Social. Bringing a friend.', 'amber', false),
      this.guest('kendall', 'Kendall S.', 'K', 'Photo moments at golden hour, please.', 'champagne', false),
      this.guest('taylor', 'Taylor B.', 'T', '', 'burgundy', false),
      this.guest('avery', 'Avery L.', 'A', '', 'ivory', false),
    ];

    this.tickets = [
      this.seedTicket('t-1', 'o-preview', IDS.sampleGuest, 'Sample Guest', 'SAMPLE-SS01-0001', 'valid', 1, 2),
      this.seedTicket('t-2', 'o-preview', IDS.sampleGuest, 'Sample Guest', 'SAMPLE-SS01-0002', 'valid', 2, 2),
      this.seedTicket('t-3', 'o-maya', 'maya', 'Maya R.', 'SAMPLE-SS01-0003', 'valid', 1, 1),
      this.seedTicket('t-4', 'o-jordan', 'jordan', 'Jordan T.', 'SAMPLE-SS01-0004', 'valid', 1, 1),
      this.seedTicket('t-5', 'o-dana', 'dana', 'Dana K.', 'SAMPLE-SS01-0005', 'valid', 1, 1),
      this.seedTicket('t-6', 'o-kendall', 'kendall', 'Kendall S.', 'SAMPLE-SS01-0006', 'valid', 1, 1),
      this.seedTicket('t-7', 'o-taylor', 'taylor', 'Taylor B.', 'SAMPLE-SS01-0007', 'valid', 1, 1),
      this.seedTicket('t-8', 'o-avery', 'avery', 'Avery L.', 'SAMPLE-SS01-0008', 'valid', 1, 1),
      this.seedTicket('t-refund', 'o-refund', IDS.sampleGuest, 'Sample Guest', 'SAMPLE-SS01-0099', 'refunded', 1, 1),
    ];

    this.viewerState = {
      id: IDS.you,
      demo: true,
      doorStaff: true,
      followingHost: true,
      ticketEventIds: [],
    };
  }

  createPaid(input: NewPaidOrder): PlacedOrder {
    const existing = this.orders.find((order) => order.paymentRef === input.paymentRef);
    if (existing) {
      return cloneOrder(existing);
    }
    const made: TicketRecord[] = [];
    for (let index = 0; index < input.quantity; index += 1) {
      const serial = this.serial;
      this.serial += 1;
      made.push(
        this.seedTicket(
          `t-new-${serial}`,
          `o-${input.paymentRef}`,
          input.profileId,
          input.guestName,
          `SAMPLE-SS${this.events[0]?.edition ?? '01'}-${String(serial).padStart(4, '0')}`,
          'valid',
          index + 1,
          input.quantity,
        ),
      );
    }
    const order: PlacedOrder = {
      id: `o-${input.paymentRef}`,
      eventId: input.eventId,
      tierId: input.tierId,
      quantity: input.quantity,
      totalCents: input.totalCents,
      unitCents: input.unitCents,
      status: 'paid',
      sample: true,
      paymentRef: input.paymentRef,
      profileId: input.profileId,
      tickets: made.map(cloneTicket),
    };
    this.orders.push(order);
    if (!this.viewerState.ticketEventIds.includes(input.eventId) && input.profileId === this.viewerState.id) {
      this.viewerState = {
        ...this.viewerState,
        ticketEventIds: [...this.viewerState.ticketEventIds, input.eventId],
      };
    }
    return cloneOrder(order);
  }

  doorCounts(eventId: string): DoorCounts {
    const admitted = this.tickets.filter((row) => row.eventId === eventId && row.status === 'checked_in').length;
    const event = this.events.find((row) => row.id === eventId);
    return {
      admitted: 42 + admitted,
      capacity: event?.capacity ?? 60,
      pending: 3,
      sample: true,
    };
  }

  private profile(
    id: string,
    displayName: string,
    monogram: string,
    bio: string,
    showPhoto: boolean,
    showOnLists: boolean,
    notifyOnDates: boolean,
    tile: TileName,
    sample: boolean,
  ): GuestProfile {
    return { id, displayName, monogram, bio, showPhoto, showOnLists, notifyOnDates, tile, sample };
  }

  private guest(
    id: string,
    displayName: string,
    monogram: string,
    bio: string,
    tile: TileName,
    youKnow: boolean,
  ): WallGuest {
    return {
      ...this.profile(id, displayName, monogram, bio, false, true, false, tile, true),
      youKnow,
      tierName: 'Golden Hour',
    };
  }

  private seedTicket(
    id: string,
    orderId: string,
    holderId: string,
    guestName: string,
    code: string,
    status: TicketRecord['status'],
    index: number,
    total: number,
  ): TicketRecord {
    const row = ticket({
      id,
      orderId,
      eventId: IDS.sunset,
      eventName: 'Sunset Social',
      edition: '01',
      tierId: IDS.golden,
      tierName: 'Golden Hour',
      holderId,
      guestName,
      code,
      status,
      index,
      total,
      sample: true,
      eventTiming: 'upcoming',
      doorsLabel: copy.doors,
      venueLabel: copy.venueHolders,
      date: sunsetDate,
    });
    if (id.startsWith('t-new-')) {
      this.tickets.push(row);
    }
    return row;
  }

  updateProfile(id: string, patch: ProfilePatch): GuestProfile {
    const index = this.profiles.findIndex((profile) => profile.id === id);
    if (index < 0) {
      throw new Error('Profile not found.');
    }
    const current = this.profiles[index];
    if (!current) {
      throw new Error('Profile not found.');
    }
    const next: GuestProfile = {
      ...current,
      ...patch,
      monogram: patch.displayName ? monogramFrom(patch.displayName) : current.monogram,
    };
    this.profiles[index] = next;
    return { ...next };
  }
}

function monogramFrom(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter || 'Y';
}

export function cloneTicket(ticketRow: TicketRecord): TicketRecord {
  return { ...ticketRow, date: ticketRow.date ? { ...ticketRow.date } : null };
}

export function cloneOrder(order: PlacedOrder): PlacedOrder {
  return { ...order, tickets: order.tickets.map(cloneTicket) };
}
