import { existsSync, readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { E2E_MAILBOX } from './ports.mjs';

interface Mail {
  kind: 'verify-email' | 'reset-password' | 'existing-account';
  to: string;
  link?: string;
}

/** Waits for the newest email of a kind to an address in the e2e API's dev mailbox and returns its link. */
export async function linkFromMailbox(to: string, kind: Mail['kind']): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      () => {
        if (!existsSync(E2E_MAILBOX)) return undefined;
        const mails = readFileSync(E2E_MAILBOX, 'utf8')
          .split('\n')
          .filter((line) => line.length > 0)
          .map((line) => JSON.parse(line) as Mail);
        link = mails.findLast((m) => m.to === to && m.kind === kind)?.link;
        return link;
      },
      { timeout: 10_000 },
    )
    .toBeDefined();
  return link ?? '';
}
