import { BIO_LIMIT } from '@/domain/copy';
import type { GuestProfile, ProfilePatch, ProfileStats, Viewer, WallModel } from '@/domain/types';
import { GuestError } from '@/services/errors';
import type { GuestPort, TicketPort } from '@/services/ports';

export class GuestService {
  constructor(
    private readonly guests: GuestPort,
    private readonly tickets: TicketPort,
  ) {}

  viewer(): Viewer {
    return this.guests.viewer();
  }

  async profile(id: string): Promise<GuestProfile> {
    return this.guests.getProfile(id);
  }

  async stats(id: string): Promise<ProfileStats> {
    const profile = await this.guests.getProfile(id);
    const tickets = await this.tickets.listForHolder(id);
    const following = await this.guests.followingCount(id);
    return {
      evenings: 0,
      following,
      tickets: tickets.length,
      profile,
    };
  }

  async update(id: string, patch: ProfilePatch): Promise<GuestProfile> {
    const next: ProfilePatch = { ...patch };
    if (next.displayName != null) {
      next.displayName = next.displayName.trim();
      if (next.displayName.length === 0) {
        throw new GuestError('Add a name for the guest list.');
      }
    }
    if (next.bio != null) {
      next.bio = next.bio.trim();
      if (next.bio.length > BIO_LIMIT) {
        throw new GuestError('Bios stay within 160 characters.');
      }
    }
    return this.guests.updateProfile(id, next);
  }

  async wall(eventId: string, viewer: Viewer): Promise<WallModel> {
    const holds = viewer.ticketEventIds.includes(eventId);
    if (!holds && !viewer.demo) {
      return { locked: true, reason: 'The guest list is visible to ticket holders.' };
    }
    const profile = await this.guests.getProfile(viewer.id);
    const people = await this.guests.listWall(eventId);
    return {
      locked: false,
      going: people.length,
      youKnow: people.filter((person) => person.youKnow).length,
      people,
      sample: people.length > 0 && people.every((person) => person.sample),
      viewerVisible: profile.showOnLists,
    };
  }

  async wave(fromId: string, toId: string, eventId: string): Promise<boolean> {
    if (fromId === toId) {
      throw new GuestError('You cannot wave at yourself.');
    }
    return this.guests.wave(fromId, toId, eventId);
  }

  async setFollowing(profileId: string, following: boolean): Promise<number> {
    return this.guests.setFollowing(profileId, following);
  }
}
