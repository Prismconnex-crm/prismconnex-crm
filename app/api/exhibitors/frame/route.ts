import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { httpFetcher } from "@/lib/find-shows/floor-plan-discovery";
import { UNCHECKED, frameVerdict, type FrameVerdict } from "@/lib/find-shows/official-frame";
import { exhibitorViewerUrl, knownFrameRefusal, usesInAppWebsiteViewer } from "@/lib/exhibitors/website-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000;
const verdicts = new Map<string, { at: number; verdict: FrameVerdict }>();

/**
 * Whether a CRM exhibitor's page may be shown in the Exhibitors tab's in-app viewer: GET ?id=<EventExhibitor.id>.
 * The CRM twin of /api/find-shows/exhibitors/official-frame: the address comes from the stored row (website →
 * directory profile → event directory), never from the request, and must be plain http(s); the page's own
 * X-Frame-Options / CSP frame-ancestors are read and respected, nothing bypassed. Answers { url, frame, reason }.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const row = await prisma.eventExhibitor.findUnique({
    where: { id },
    select: { eventSlug: true, websiteUrl: true, sourceDetailUrl: true, sourceDirectoryUrl: true },
  });
  // Only events using the in-app viewer answer here; any other row is as good as unknown.
  if (!row || !usesInAppWebsiteViewer(row.eventSlug)) {
    return NextResponse.json({ error: "No such exhibitor." }, { status: 404 });
  }
  const url = exhibitorViewerUrl({ website: row.websiteUrl, profileUrl: row.sourceDetailUrl, directoryUrl: row.sourceDirectoryUrl });
  if (!url) return NextResponse.json({ error: "This exhibitor has no web address that can be shown." }, { status: 404 });

  // A site verified to refuse framing that the check below cannot see (it answers servers with a bot challenge).
  const refusal = knownFrameRefusal(url);
  if (refusal) return NextResponse.json({ url, frame: "blocked", reason: refusal });

  const origin = new URL(request.url).origin;
  const cached = verdicts.get(`${origin} ${url}`);
  if (cached && Date.now() - cached.at < TTL_MS) return NextResponse.json({ url, ...cached.verdict });

  let verdict: FrameVerdict;
  try {
    const answer = await httpFetcher(url, { accept: "text/html,*/*;q=0.5", timeoutMs: 12_000, maxBytes: 64_000 });
    verdict = frameVerdict({ ...answer, challenged: /challenge/.test(answer.headers["cf-mitigated"] ?? "") }, origin);
  } catch {
    verdict = { frame: "unknown", reason: UNCHECKED.unreachable };
  }
  verdicts.set(`${origin} ${url}`, { at: Date.now(), verdict });
  return NextResponse.json({ url, ...verdict });
}
