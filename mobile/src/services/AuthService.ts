import type { DataMode } from '@/domain/types';
import { AuthError } from '@/services/errors';
import type { AuthGateway } from '@/services/ports';

export class AuthService {
  constructor(
    private readonly gateway: AuthGateway,
    readonly mode: DataMode,
  ) {}

  normalizeUsPhone(input: string): string {
    const digits = input.replace(/\D/g, '');
    const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    if (national.length !== 10) {
      throw new AuthError('Use a U.S. mobile number.');
    }
    return `+1${national}`;
  }

  assertEmail(input: string): string {
    const email = input.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthError('Use a valid email address.');
    }
    return email;
  }

  async sendPhone(phone: string): Promise<void> {
    this.assertLive();
    await this.gateway.sendPhone(this.normalizeUsPhone(phone));
  }

  async verifyPhone(phone: string, code: string): Promise<void> {
    this.assertLive();
    this.assertCode(code);
    await this.gateway.verifyPhone(this.normalizeUsPhone(phone), code.trim());
  }

  async sendEmail(email: string): Promise<void> {
    this.assertLive();
    await this.gateway.sendEmail(this.assertEmail(email));
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    this.assertLive();
    this.assertCode(code);
    await this.gateway.verifyEmail(this.assertEmail(email), code.trim());
  }

  async signOut(): Promise<void> {
    if (this.mode === 'demo') {
      return;
    }
    await this.gateway.signOut();
  }

  async deleteAccount(): Promise<void> {
    if (this.mode === 'demo') {
      return;
    }
    await this.gateway.deleteAccount();
  }

  private assertLive(): void {
    if (this.mode === 'demo') {
      throw new AuthError('Demo mode uses the sample profile. Connect Supabase to send a real code.');
    }
  }

  private assertCode(code: string): void {
    if (!/^\d{6}$/.test(code.trim())) {
      throw new AuthError('Enter the 6-digit code.');
    }
  }
}
