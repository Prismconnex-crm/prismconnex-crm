/**
 * EyeLed exhibitor directories (SPIEL and other fairs using EyeLed's
 * exhibitor app): the official exhibitor page embeds
 * `https://<customer>.eyeled-services.de/<app><yy>/js/app.<hash>.js`, whose
 * bundle names its project (`project="spiel26"`) and loads the public list
 * `https://maps.eyeled-services.de/<lang>/<project>/exhibitors`.
 *
 * Only public, non-contact columns are requested (no e-mail, phone or
 * address). The bundle also carries credentials for EyeLed's update backend;
 * they are never read or used. EyeLed opens an exhibitor's details inside the
 * official page without an address of its own, so a card opens the official
 * exhibitor page.
 */
import { judgeEdition, shortDescription, type ExhibitorCard, type ExhibitorSource } from '../exhibitors';
import { Unreachable, isOk, readJson, rejected, type ExhibitorAdapter } from './types';

const APP = /https:\/\/([a-z0-9-]+)\.eyeled-services\.de\/[a-z_-]*?(\d{2})?\/js\/app\.[a-z0-9]+\.js/i;
const BACKEND = 'https://maps.eyeled-services.de';
/** Public card fields only. */
const COLUMNS = ['ID', 'NAME', 'LOGO', 'STAND', 'HALLE', 'INFO', 'S_ORDER'];

export type EyeLedLead = { pageUrl: string; appUrl: string };

/** The project an EyeLed app bundle loads (`wc.project="spiel26"`), and its backend. */
export function eyeLedProject(bundle: string) {
  const project = bundle.match(/\.project\s*=\s*["']([a-z0-9_-]+)["']/i)?.[1];
  const backend = bundle.match(/\.backendUrl\s*=\s*["'](https:\/\/[a-z0-9.-]+\.eyeled-services\.de)["']/i)?.[1] ?? BACKEND;
  return project ? { project, backend } : null;
}

/** "spiel26" → 2026: the edition the project names. */
export const eyeLedYear = (project: string) => {
  const yy = project.match(/(\d{2})$/)?.[1];
  return yy ? 2000 + Number(yy) : null;
};

type EyeLedRecord = { ID?: string; NAME?: string; LOGO?: string; STAND?: string; HALLE?: string; INFO?: string };

export function eyeLedCards(answer: unknown, pageUrl: string): ExhibitorCard[] | null {
  const data = answer as { path?: string; exhibitors?: EyeLedRecord[] };
  if (!Array.isArray(data?.exhibitors)) return null;
  const cards: ExhibitorCard[] = [];
  const seen = new Set<string>();
  for (const record of data.exhibitors) {
    const id = String(record.ID ?? '');
    const name = (record.NAME ?? '').trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const booth = [record.HALLE?.trim(), record.STAND?.trim()].filter(Boolean).join(' / ');
    cards.push({
      id,
      name,
      logoUrl: record.LOGO && data.path ? `${BACKEND}/${data.path.replace(/^\/+/, '')}${encodeURIComponent(record.LOGO)}` : null,
      booths: booth ? [booth] : [],
      description: shortDescription(record.INFO),
      profileUrl: pageUrl,
      access: 'public',
    });
  }
  return cards;
}

export const eyeLedAdapter: ExhibitorAdapter = {
  id: 'eyeled',
  detect(page) {
    const apps = new Set<string>();
    for (const match of Array.from(page.html.matchAll(new RegExp(APP.source, 'gi')))) apps.add(match[0]);
    return Array.from(apps).map((appUrl) => ({ adapter: 'eyeled' as const, key: `eyeled:${appUrl}`, foundOn: page.url, data: { pageUrl: page.url, appUrl } }));
  },

  async resolve(raw, { target, fetcher }) {
    const lead = raw.data as EyeLedLead;
    const bundle = await fetcher(lead.appUrl, { accept: 'application/javascript,*/*;q=0.5', timeoutMs: 30_000, maxBytes: 6_000_000 });
    if (!isOk(bundle.status)) throw new Unreachable(`HTTP ${bundle.status} from ${new URL(lead.appUrl).host}`);
    const app = eyeLedProject(bundle.body.toString('utf8'));
    if (!app) return rejected('eyeled', lead.appUrl, lead.pageUrl, 'the EyeLed app names no project');
    const year = eyeLedYear(app.project);
    const label = `${target.name} ${year ?? ''}`.trim();
    if (!year) return rejected('eyeled', app.project, lead.pageUrl, `the EyeLed project "${app.project}" does not say which year it is for`);
    const verdict = judgeEdition(target, { label, year });
    if (!verdict.ok) return rejected('eyeled', app.project, lead.pageUrl, verdict.reason);

    const params = new URLSearchParams({ columns: JSON.stringify(COLUMNS) });
    const answer = await readJson(fetcher, `${app.backend}/en/${encodeURIComponent(app.project)}/exhibitors?${params}`);
    const cards = eyeLedCards(answer, lead.pageUrl);
    if (!cards) throw new Unreachable('the EyeLed list returned an unexpected response');
    const source: ExhibitorSource = {
      platform: 'eyeled',
      platformLabel: 'Official exhibitor list',
      editionLabel: label,
      directoryUrl: lead.pageUrl,
      loginUrl: null,
      foundOn: raw.foundOn,
    };
    return cards.length ? { kind: 'list', source, exhibitors: cards } : { kind: 'empty', source };
  },
};
