/** Local stand-in. A later release can forward `drain()` to @sentry/react-native when a DSN exists. */
export class SentryReporter {
  private readonly seen: string[] = [];

  constructor(private readonly dsn: string | null) {}

  get enabled(): boolean {
    return Boolean(this.dsn);
  }

  capture(error: unknown): void {
    if (!this.dsn) {
      return;
    }
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    this.seen.push(message);
  }

  drain(): string[] {
    return [...this.seen];
  }
}
