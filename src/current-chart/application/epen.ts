import type { EpenMessage, TimeRange } from '../domain';

/**
 * Where e-pen notes are kept (manual §11.1.1 EPEN). The production store is the COA server;
 * no API for it was supplied, so the app uses the in-memory store below.
 */
export interface EpenStore {
  save(message: EpenMessage): Promise<void>;
  /** "Message Show": all saved messages of a time period. */
  list(range: TimeRange): Promise<EpenMessage[]>;
}

export class InMemoryEpenStore implements EpenStore {
  private readonly messages: EpenMessage[] = [];

  save(message: EpenMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }

  list(range: TimeRange): Promise<EpenMessage[]> {
    return Promise.resolve(this.messages.filter((m) => m.at >= range.start && m.at <= range.end));
  }
}
