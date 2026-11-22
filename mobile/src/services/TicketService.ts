import type { TicketRecord, WalletModel } from '@/domain/types';
import type { TicketPort } from '@/services/ports';

export class TicketService {
  constructor(private readonly tickets: TicketPort) {}

  async wallet(viewerId: string): Promise<WalletModel> {
    const own = await this.tickets.listForHolder(viewerId);
    const rows = own.length > 0 ? own : await this.tickets.listSamplePreview();
    const visible = rows.filter((ticket) => ticket.status === 'valid' || ticket.status === 'checked_in');
    return {
      upcoming: visible.filter((ticket) => ticket.eventTiming === 'upcoming'),
      past: visible.filter((ticket) => ticket.eventTiming === 'past'),
      sample: rows.some((ticket) => ticket.sample),
    };
  }

  async get(id: string, holderId: string): Promise<TicketRecord | null> {
    const own = await this.tickets.listForHolder(holderId);
    const preview = own.length > 0 ? [] : await this.tickets.listSamplePreview();
    return [...own, ...preview].find((ticket) => ticket.id === id) ?? null;
  }
}
