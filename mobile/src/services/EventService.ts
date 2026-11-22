import { copy } from '@/domain/copy';
import type { RevealView, SocialEvent, TicketTier, Viewer } from '@/domain/types';
import { EventMissingError } from '@/services/errors';
import type { EventReader } from '@/services/ports';

export class EventService {
  constructor(private readonly reader: EventReader) {}

  async list(): Promise<SocialEvent[]> {
    const events = await this.reader.listEvents();
    return [...events].sort((a, b) => a.edition.localeCompare(b.edition));
  }

  async get(id: string): Promise<SocialEvent> {
    const event = await this.reader.getEvent(id);
    if (!event) {
      throw new EventMissingError(id);
    }
    return event;
  }

  async tiers(eventId: string): Promise<TicketTier[]> {
    const tiers = await this.reader.listTiers(eventId);
    return [...tiers].sort((a, b) => a.sort - b.sort);
  }

  locationCopy(event: SocialEvent): { title: string; detail: string } {
    return {
      title: event.venuePublicLabel,
      detail: copy.addressHolders,
    };
  }

  async reveal(eventId: string, viewer: Viewer): Promise<RevealView> {
    const holds = viewer.ticketEventIds.includes(eventId);
    if (!holds) {
      return {
        unlocked: false,
        venueName: null,
        address: null,
        note: copy.addressHolders,
      };
    }
    const row = await this.reader.getReveal(eventId);
    const address = row?.address?.trim() ? row.address.trim() : null;
    const venueName = row?.venueName?.trim() ? row.venueName.trim() : null;
    return {
      unlocked: true,
      venueName,
      address,
      note: address ? 'Shown because you hold a ticket.' : copy.revealLater,
    };
  }

  calendarUrl(event: SocialEvent): string | null {
    if (!event.hasDate || event.id !== 'sunset-social') {
      return null;
    }
    const text = encodeURIComponent(event.name);
    const details = encodeURIComponent(`${copy.timeTba}. ${copy.addressHolders}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=20270123T170000/20270123T200000&ctz=America/New_York&details=${details}`;
  }

  shareMessage(event: SocialEvent): string {
    if (event.hasDate) {
      return `${event.name} — ${event.longWhen}. ${event.timeLabel}. ${copy.venueAnnounced}.`;
    }
    return `${event.name} — ${event.shortWhen}. ${copy.venueAnnounced}.`;
  }
}
