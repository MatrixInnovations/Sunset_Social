import type { TileName } from '@/theme/tokens';

export type DataMode = 'demo' | 'live';

export type TicketStatus = 'valid' | 'checked_in' | 'void' | 'refunded' | 'transferred';

export type ScanOutcome = 'admitted' | 'duplicate' | 'void' | 'refunded' | 'unknown' | 'wrong_event';

export type SocialEvent = {
  id: string;
  edition: string;
  seriesLabel: string;
  editionLabel: string;
  name: string;
  italicTail: string | null;
  tagline: string;
  shortWhen: string;
  longWhen: string | null;
  timeLabel: string;
  hasDate: boolean;
  priceFromCents: number | null;
  hero: 'toast' | 'tasting';
  status: 'on_sale' | 'announced';
  ageNote: string | null;
  venuePublicLabel: string;
  cardDetail: string;
  capacity: number | null;
  hostName: string;
  hostLine: string;
};

export type TicketTier = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  priceCents: number | null;
  maxPerOrder: number;
  purchasable: boolean;
  sort: number;
};

export type TicketDate = {
  month: string;
  day: string;
  year: string;
  weekday: string;
  time: string;
};

export type TicketRecord = {
  id: string;
  orderId: string;
  eventId: string;
  eventName: string;
  edition: string;
  tierId: string;
  tierName: string;
  holderId: string;
  guestName: string;
  code: string;
  status: TicketStatus;
  index: number;
  total: number;
  sample: boolean;
  eventTiming: 'upcoming' | 'past';
  doorsLabel: string;
  venueLabel: string;
  date: TicketDate | null;
};

export type PlacedOrder = {
  id: string;
  eventId: string;
  tierId: string;
  quantity: number;
  totalCents: number;
  unitCents: number;
  status: 'paid' | 'refunded';
  sample: boolean;
  paymentRef: string;
  profileId: string;
  tickets: TicketRecord[];
};

export type GuestProfile = {
  id: string;
  displayName: string;
  monogram: string;
  bio: string;
  showPhoto: boolean;
  showOnLists: boolean;
  notifyOnDates: boolean;
  tile: TileName;
  sample: boolean;
};

export type WallGuest = GuestProfile & {
  youKnow: boolean;
  tierName: string;
};

export type Viewer = {
  id: string;
  demo: boolean;
  doorStaff: boolean;
  followingHost: boolean;
  ticketEventIds: string[];
};

export type ProfilePatch = {
  displayName?: string;
  bio?: string;
  showPhoto?: boolean;
  showOnLists?: boolean;
  notifyOnDates?: boolean;
};

export type ProfileStats = {
  evenings: number;
  following: number;
  tickets: number;
  profile: GuestProfile;
};

export type WallModel =
  | { locked: true; reason: string }
  | {
      locked: false;
      going: number;
      youKnow: number;
      people: WallGuest[];
      sample: boolean;
      viewerVisible: boolean;
    };

export type WalletModel = {
  upcoming: TicketRecord[];
  past: TicketRecord[];
  sample: boolean;
};

export type Quote = {
  quantity: number;
  unitCents: number;
  totalCents: number;
  tierName: string;
  eventId: string;
};

export type PlaceInput = {
  tierId: string;
  quantity: number;
  profileId: string;
  guestName: string;
  idempotencyKey?: string;
};

export type NewPaidOrder = PlaceInput & Quote & { sample: boolean; paymentRef: string };

export type RevealView = {
  unlocked: boolean;
  venueName: string | null;
  address: string | null;
  note: string;
};

export type VenueRevealRow = {
  eventId: string;
  venueName: string | null;
  address: string | null;
  notes: string | null;
};

export type ScanResult = {
  outcome: ScanOutcome;
  guestName: string | null;
  tierName: string | null;
  code: string | null;
  index: number | null;
  total: number | null;
  sample: boolean;
  paidLabel: string | null;
};

export type DoorCounts = {
  admitted: number;
  capacity: number;
  pending: number;
  sample: boolean;
};

export type ReviewOrder = {
  id: string;
  eventId: string;
  eventName: string;
  status: 'review';
  reviewNote: string;
  createdAt: string;
  sample: boolean;
};

export type DoorGuest = {
  id: string;
  name: string;
  code: string;
  tierName: string;
  status: TicketStatus;
  sample: boolean;
};

export type CheckinEntry = {
  ticketId: string | null;
  eventId: string;
  staffId: string;
  code: string;
  result: ScanOutcome;
};

export type IntentRequest = {
  tierId: string;
  quantity: number;
  idempotencyKey: string;
};

export type IntentResponse = {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
};
