import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/** One transactional email (D01 `Mailer` port). Plain text in the MVP; HTML templates arrive with S12 polish. */
export interface MailMessage {
  /** Which flow sent it: lets tests and the dev mailbox find the right email without parsing prose. */
  kind: 'verify-email' | 'reset-password' | 'existing-account';
  to: string;
  subject: string;
  text: string;
  /** The action link inside `text` (verification / reset), when there is one. */
  link?: string;
}

/**
 * Delivery port. Implementations: in-memory (tests), dev mailbox file (local development and E2E), and a real
 * provider (chosen in Part 2.10; production refuses to start without one, see config.ts).
 * A failing mailer must never fail sign-up (D01 failure handling): callers log and continue; users can resend.
 */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
  /** The newest email of a kind to an address (tests). */
  last(to: string, kind: MailMessage['kind']): MailMessage | undefined {
    return this.sent.findLast((m) => m.to === to && m.kind === kind);
  }
}

/** Appends each email as one JSON line to a local file (git-ignored). Never used in production. */
export class DevFileMailer implements Mailer {
  constructor(
    private readonly path: string,
    private readonly from: string,
  ) {}
  async send(message: MailMessage): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const line = JSON.stringify({ at: new Date().toISOString(), from: this.from, ...message });
    await appendFile(this.path, `${line}\n`, 'utf8');
  }
}
