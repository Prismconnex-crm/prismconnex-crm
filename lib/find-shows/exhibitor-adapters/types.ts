/**
 * The contract every exhibitor-directory adapter implements. Discovery
 * (exhibitor-discovery.ts) gathers the event's official pages; each adapter
 * spots its own platform on them (`detect`, pure) and reads the edition's list
 * from what it spotted (`resolve`). Adding a platform is adding an adapter to
 * the registry (./index.ts) — never event-specific code.
 */
import type { Fetcher } from '../floor-plan-discovery';
import type { Poster } from './http';
import type { EditionTarget, ExhibitorCard, ExhibitorPlatform, ExhibitorSource, RejectedSource } from '../exhibitors';

/** An official page: the event's site, a page it links about exhibitors, or its edition page on the organizer's site. */
export type OfficialPage = { url: string; html: string };

export type AdapterContext = {
  target: EditionTarget;
  fetcher: Fetcher;
  /** Form POSTs, for directories whose official pages load their cards that way. */
  post: Poster;
  /** Registrable site of the official website ("powergen.com"): a directory on it or its subdomains is the organizer's own. */
  site: string;
  /** The official pages already read, so an adapter need not fetch them again. */
  pages: OfficialPage[];
};

/** Something an adapter spotted on an official page: enough to read the directory later. */
export type Lead = { adapter: ExhibitorPlatform; key: string; foundOn: string; data: unknown };

export type Candidate =
  | { kind: 'list'; source: ExhibitorSource; exhibitors: ExhibitorCard[]; total?: number | null; partial?: boolean }
  | { kind: 'login'; source: ExhibitorSource }
  /** The edition's official list page, verified, whose list cannot be read here. */
  | { kind: 'link'; source: ExhibitorSource }
  | { kind: 'empty'; source: ExhibitorSource }
  | { kind: 'rejected'; rejected: RejectedSource }
  | { kind: 'failed'; reason: string };

export type ExhibitorAdapter = {
  id: ExhibitorPlatform;
  /** Leads this adapter recognises on one official page. Pure: no fetching. */
  detect(page: OfficialPage, context: Pick<AdapterContext, 'site' | 'target'>): Lead[];
  /** The directory a lead points to, checked against the edition. Throws `Unreachable` on a network failure. */
  resolve(lead: Lead, context: AdapterContext): Promise<Candidate>;
};

/** A request that never got a usable answer: says nothing about whether exhibitors exist. */
export class Unreachable extends Error {
  name = 'Unreachable';
}

export const HTML_ACCEPT = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5';
export const JSON_ACCEPT = 'application/json,text/javascript;q=0.9,*/*;q=0.5';
export const PAGE_LIMIT = { timeoutMs: 20_000, maxBytes: 4_000_000 };
export const DATA_LIMIT = { timeoutMs: 30_000, maxBytes: 20_000_000 };

export const isOk = (status: number) => status >= 200 && status < 300;

export async function readJson(fetcher: Fetcher, url: string, headers?: Record<string, string>) {
  const response = await fetcher(url, { accept: JSON_ACCEPT, ...DATA_LIMIT, headers });
  if (!isOk(response.status)) throw new Unreachable(`HTTP ${response.status} from ${new URL(url).host}`);
  try {
    return JSON.parse(response.body.toString('utf8')) as unknown;
  } catch {
    throw new Unreachable(`${new URL(url).host} did not return JSON`);
  }
}

/** A bot wall (Cloudflare's "Just a moment…" challenge and the like): the page was not shown to us. */
const BOT_CHALLENGE = /<title>\s*(?:just a moment|attention required|access denied)|cf-chl-|challenge-platform|cf-mitigated/i;

/**
 * An official page's HTML. A directory that refuses automated requests
 * (401/403, a bot challenge) was not checked: that throws `Unreachable`, so
 * the search ends unfinished, never as "no exhibitors".
 */
export async function readHtml(fetcher: Fetcher, url: string, limits: { timeoutMs: number; maxBytes: number } = PAGE_LIMIT) {
  const response = await fetcher(url, { accept: HTML_ACCEPT, ...limits });
  const html = response.body.toString('utf8');
  if (response.status === 401 || response.status === 403 || (response.headers['cf-mitigated'] ?? '') === 'challenge' || BOT_CHALLENGE.test(html.slice(0, 20_000))) {
    throw new Unreachable(`${new URL(url).host} refuses automated requests (HTTP ${response.status})`);
  }
  return { url: response.url, status: response.status, html };
}

export const rejected = (platform: ExhibitorPlatform, label: string, url: string, reason: string): Candidate => ({
  kind: 'rejected',
  rejected: { platform, label, url, reason },
});
