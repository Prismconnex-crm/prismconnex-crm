/**
 * Industry for every event's exhibitors, classified by Claude (claude-opus-5-5) through the Message Batches API.
 *
 *   npm run exhibitors:claude-industries -- --submit [--sample=500]   send groups of 50 exhibitors as one batch
 *   npm run exhibitors:claude-industries -- --status                   show the saved batches' progress
 *   npm run exhibitors:claude-industries -- --collect [--apply]        read finished results (dry run unless --apply)
 *
 * Needs ANTHROPIC_API_KEY (kept in .env.local, which git ignores). Billing: the Batch API is half price.
 *
 * What Claude sees per exhibitor: its name, the show it exhibits at, its directory categories and the
 * description already stored (from the directory or its own website) — nothing else, and it is told to say
 * "Unknown" rather than guess. Each answer carries its basis:
 *   - "company": the name or text identifies the business → industrySource "claude:<model>";
 *   - "show": only the show suggests it → industrySource "show-category" (the profile labels it "show sector");
 *   - "none": nothing to go on → left empty.
 * Only empty industries are written (BETT's existing classifications stay). Contact data — website, phone,
 * LinkedIn — is never asked of the model: those come only from pages that publish them.
 */
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db/prisma';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { GENERAL_INDUSTRIES } from '@/lib/exhibitors/general-industry';

const MODEL = 'claude-opus-5-5';
const GROUP = 50;
const has = (f: string) => process.argv.includes(`--${f}`);
const arg = (n: string) => process.argv.find((v) => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const stateFile = path.join(process.cwd(), '.next', 'cache', 'exhibitor-enrichment', 'claude-batches.json');

type State = { batches: Array<{ id: string; createdAt: string; groups: Record<string, string[]>; collected?: boolean }> };
const readState = (): State => (fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { batches: [] });
const writeState = (s: State) => {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(s, null, 1));
};

const SYSTEM = `You classify trade-show exhibitors into exactly one industry sector each.

Sectors (use these exact strings): ${GENERAL_INDUSTRIES.join('; ')}.

For each exhibitor you get its company name, the show it exhibits at, and sometimes its directory categories and a description taken from its own website or the show directory.

Rules:
- Pick the sector describing what the company itself does (makes, sells or provides), not what its customers do.
- basis "company" when the name, categories or description identify the business.
- basis "show" when they do not, but the show's theme makes one sector clearly likely; pick that sector.
- basis "none" and industry "Unknown" when even that is unclear. A blank is better than a wrong sector: people act on this field when choosing whom to meet.
- evidence: at most 12 words naming what decided it (e.g. "description: CNC machining centres", "name: Robotics", "show: MEDICA medical fair").
Return one result per exhibitor, using its "i" number.`;

const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          industry: { type: 'string', enum: [...GENERAL_INDUSTRIES, 'Unknown'] },
          basis: { type: 'string', enum: ['company', 'show', 'none'] },
          evidence: { type: 'string' },
        },
        required: ['i', 'industry', 'basis', 'evidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
};

type Row = { id: string; eventSlug: string; companyName: string; description: string | null; categories: string[] };

function showLabel(slug: string): string {
  const e = findShowEventsBySlug[slug];
  if (!e) return slug.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-/g, ' ');
  return `${e.name} (${[e.city, e.country !== 'Unknown' ? e.country : null].filter(Boolean).join(', ')}; ${e.categories.join(', ')})`;
}

async function submit(client: Anthropic) {
  const state = readState();
  const pending = new Set(state.batches.filter((b) => !b.collected).flatMap((b) => Object.values(b.groups).flat()));
  let rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, "eventSlug", "companyName", description, categories FROM "EventExhibitor" WHERE industry IS NULL ORDER BY "eventSlug", id`,
  );
  rows = rows.filter((r) => !pending.has(r.id));
  const sample = arg('sample');
  if (sample) rows = rows.sort(() => Math.random() - 0.5).slice(0, Number(sample));
  if (!rows.length) return console.log('Nothing to submit.');

  const groups: Record<string, string[]> = {};
  const requests: Anthropic.Messages.Batches.BatchCreateParams.Request[] = [];
  for (let g = 0; g * GROUP < rows.length; g++) {
    const chunk = rows.slice(g * GROUP, (g + 1) * GROUP);
    const customId = `g${Date.now().toString(36)}-${g}`;
    groups[customId] = chunk.map((r) => r.id);
    const lines = chunk.map((r, i) =>
      JSON.stringify({
        i,
        name: r.companyName,
        show: showLabel(r.eventSlug),
        ...(r.categories?.length ? { categories: r.categories.slice(0, 6) } : {}),
        ...(r.description ? { description: r.description.replace(/\s+/g, ' ').slice(0, 400) } : {}),
      }),
    );
    requests.push({
      custom_id: customId,
      params: {
        model: MODEL,
        max_tokens: 16000,
        // Stable system prompt first, cached across every request in the batch.
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: `Exhibitors (one JSON object per line):\n${lines.join('\n')}` }],
      },
    });
  }
  // 100,000 requests / 256 MB per batch; 2,800 groups of 50 fit comfortably, but split for safety.
  for (let i = 0; i < requests.length; i += 5000) {
    const part = requests.slice(i, i + 5000);
    const batch = await client.messages.batches.create({ requests: part });
    const partGroups = Object.fromEntries(part.map((r) => [r.custom_id, groups[r.custom_id]]));
    state.batches.push({ id: batch.id, createdAt: new Date().toISOString(), groups: partGroups });
    writeState(state);
    console.log(`Submitted ${batch.id}: ${part.length} requests (${part.reduce((n, r) => n + groups[r.custom_id].length, 0)} exhibitors)`);
  }
}

async function status(client: Anthropic) {
  for (const b of readState().batches) {
    const r = await client.messages.batches.retrieve(b.id);
    console.log(`${b.id} ${r.processing_status} ${JSON.stringify(r.request_counts)}${b.collected ? ' (collected)' : ''}`);
  }
}

async function collect(client: Anthropic) {
  const apply = has('apply');
  const state = readState();
  const updates: Array<{ id: string; industry: string; evidence: string; source: string }> = [];
  let inTok = 0, outTok = 0, cacheRead = 0, refused = 0, failed = 0, unknown = 0;
  const done: string[] = [];
  for (const b of state.batches.filter((x) => !x.collected)) {
    const r = await client.messages.batches.retrieve(b.id);
    if (r.processing_status !== 'ended') {
      console.log(`${b.id} still ${r.processing_status}`);
      continue;
    }
    for await (const res of await client.messages.batches.results(b.id)) {
      const ids = b.groups[res.custom_id] ?? [];
      if (res.result.type !== 'succeeded') {
        failed += ids.length;
        continue;
      }
      const msg = res.result.message;
      inTok += msg.usage.input_tokens;
      outTok += msg.usage.output_tokens;
      cacheRead += msg.usage.cache_read_input_tokens ?? 0;
      if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') {
        refused += ids.length;
        continue;
      }
      const text = msg.content.find((c): c is Anthropic.TextBlock => c.type === 'text')?.text;
      let parsed: { results: Array<{ i: number; industry: string; basis: string; evidence: string }> };
      try {
        parsed = JSON.parse(text ?? '');
      } catch {
        failed += ids.length;
        continue;
      }
      for (const item of parsed.results) {
        const id = ids[item.i];
        if (!id) continue;
        if (item.basis === 'none' || item.industry === 'Unknown' || !(GENERAL_INDUSTRIES as readonly string[]).includes(item.industry)) {
          unknown++;
          continue;
        }
        updates.push({
          id,
          industry: item.industry,
          evidence: item.evidence.slice(0, 160),
          source: item.basis === 'company' ? `claude:${MODEL}` : 'show-category',
        });
      }
    }
    done.push(b.id);
  }

  const byBasis = updates.reduce<Record<string, number>>((m, u) => ((m[u.source] = (m[u.source] ?? 0) + 1), m), {});
  // Batch API = half the standard rate ($4 / $20 per MTok for Opus 5.5); cache reads bill at $0.20 → $0.10.
  const cost = ((inTok * 4 + cacheRead * 0.2 + outTok * 20) / 1e6) * 0.5;
  console.log(`Classified: ${updates.length} ${JSON.stringify(byBasis)}; unknown ${unknown}; refused/truncated ${refused}; failed ${failed}`);
  console.log(`Tokens: input ${inTok}, cache-read ${cacheRead}, output ${outTok} → about $${cost.toFixed(2)}`);
  for (const u of [...updates].sort(() => Math.random() - 0.5).slice(0, Number(arg('show') ?? 0))) {
    const row = await prisma.eventExhibitor.findUnique({ where: { id: u.id }, select: { companyName: true } });
    console.log(`  ${row?.companyName.slice(0, 36).padEnd(36)} → ${u.industry} [${u.source === 'show-category' ? 'show' : 'company'}: ${u.evidence}]`);
  }
  if (!apply) return console.log('Dry run — nothing written. Re-run with --apply.');

  for (let i = 0; i < updates.length; i += 100) {
    await prisma.$transaction(
      updates.slice(i, i + 100).map((u) =>
        prisma.$executeRaw`UPDATE "EventExhibitor" SET industry = ${u.industry}, "industryEvidence" = ${[u.evidence]}, "industrySource" = ${u.source}
                           WHERE id = ${u.id} AND industry IS NULL`,
      ),
    );
  }
  for (const b of state.batches) if (done.includes(b.id)) b.collected = true;
  writeState(state);
  console.log(`Written ${updates.length}.`);
}

async function main() {
  const client = new Anthropic();
  if (has('submit')) return submit(client);
  if (has('status')) return status(client);
  if (has('collect')) return collect(client);
  console.log('Use --submit [--sample=N], --status, or --collect [--apply] [--show=N].');
}

main()
  .catch((e) => {
    console.error(e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
