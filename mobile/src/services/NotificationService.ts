import type { DataMode } from '@/domain/types';
import type { NotificationGateway } from '@/services/ports';

export type NotificationSync = { state: 'off' | 'stub' | 'registered' };

export class ExpoNotificationGateway implements NotificationGateway {
  async register(): Promise<'registered' | 'stub'> {
    try {
      const Notifications = await import('expo-notifications');
      const current = await Notifications.getPermissionsAsync();
      if (!current.granted) {
        const asked = await Notifications.requestPermissionsAsync();
        if (!asked.granted) {
          return 'stub';
        }
      }
      return 'stub';
    } catch {
      return 'stub';
    }
  }
}

export class NotificationService {
  constructor(
    private readonly mode: DataMode,
    private readonly gateway: NotificationGateway,
  ) {}

  async syncDateDrop(enabled: boolean): Promise<NotificationSync> {
    if (!enabled) {
      return { state: 'off' };
    }
    if (this.mode === 'demo') {
      return { state: 'stub' };
    }
    const result = await this.gateway.register();
    return { state: result };
  }
}
