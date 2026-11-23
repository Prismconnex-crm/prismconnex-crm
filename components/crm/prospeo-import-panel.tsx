"use client";

import { useState } from "react";
import { Loader2, Search, UploadCloud } from "lucide-react";
import type { ImportResult, PreviewResult } from "@/lib/prospeo/service";

/**
 * Prospeo pilot panel on an exhibitor's People tab: fetch → review → import.
 *
 * Nothing is fetched until the user clicks, because each search page costs a
 * Prospeo credit. Nothing is imported until the user reviews the list and
 * clicks Import; only ticked people are sent. No email/mobile enrichment.
 */

const STATUS_LABEL: Record<PreviewResult["contacts"][number]["importStatus"], string> = {
  new: "New",
  update: "Will update",
  unchanged: "Already imported",
  duplicate: "Duplicate",
};

const BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]";

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

export function ProspeoImportPanel({ exhibitorId, onImported }: { exhibitorId: string; onImported: () => void }) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"fetch" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/exhibitors/${encodeURIComponent(exhibitorId)}/prospeo`;

  async function fetchPreview() {
    setBusy("fetch");
    setError(null);
    setResult(null);
    try {
      const data = await postJson<PreviewResult>(`${base}/preview`);
      setPreview(data);
      // Pre-tick what an import would change; "already imported" and duplicates stay unticked.
      setSelected(
        new Set(data.contacts.filter((c) => c.importStatus === "new" || c.importStatus === "update").map((c) => c.externalId))
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Prospeo request failed");
    } finally {
      setBusy(null);
    }
  }

  async function runImport() {
    if (selected.size === 0) return;
    setBusy("import");
    setError(null);
    try {
      const data = await postJson<ImportResult>(`${base}/import`, { personIds: Array.from(selected) });
      setResult(data);
      setPreview(null);
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-[10px] border border-slate-200 bg-white p-3.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white">Prospeo people search</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Uses 1 Prospeo search credit per page of 25 people (repeats within 30 days are free). Emails and
            mobiles are not revealed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={BUTTON} onClick={() => void fetchPreview()} disabled={busy !== null}>
            {busy === "fetch" ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            {preview ? "Fetch again" : "Fetch from Prospeo"}
          </button>
          {preview ? (
            <button
              type="button"
              className={BUTTON}
              onClick={() => void runImport()}
              disabled={busy !== null || selected.size === 0}
            >
              {busy === "import" ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
              Import {selected.size} contact{selected.size === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-[12px] font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}

      {result ? (
        <p className="mt-2 text-[12px] text-slate-700 dark:text-slate-200">
          Imported {result.imported}, updated {result.updated}, already imported {result.unchanged}, duplicates{" "}
          {result.duplicates}, skipped {result.skipped}. Search credits used: {result.creditsUsed}.
        </p>
      ) : null}

      {preview ? (
        <div className="mt-3">
          <p className="text-[12px] text-slate-700 dark:text-slate-200">
            Prospeo found <b>{preview.totalCount}</b> people for {preview.exhibitor.domain} ({preview.pagesFetched} of{" "}
            {preview.totalPages} page{preview.totalPages === 1 ? "" : "s"}; credits used {preview.creditsUsed}).{" "}
            {preview.contacts.length} belong to {preview.exhibitor.companyName}: {preview.counts.new} new,{" "}
            {preview.counts.update} to update, {preview.counts.unchanged} already imported
            {preview.counts.duplicate ? `, ${preview.counts.duplicate} duplicate` : ""}.
            {preview.otherCompany.length ? ` ${preview.otherCompany.length} other-company result(s) excluded.` : ""}
            {preview.truncated ? " Stopped at the page limit — not every page was fetched." : ""}
          </p>
          <div className="mt-2 max-h-[320px] overflow-auto rounded-[8px] border border-slate-200 dark:border-[#22304A]">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead className="sticky top-0 bg-slate-50 dark:bg-[#0B1220]">
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={preview.contacts.length > 0 && selected.size === preview.contacts.length}
                      onChange={(event) =>
                        setSelected(event.target.checked ? new Set(preview.contacts.map((c) => c.externalId)) : new Set())
                      }
                    />
                  </th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Job title</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Email / Mobile</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1A2740]">
                {preview.contacts.map((contact) => (
                  <tr key={contact.externalId} className="text-slate-700 dark:text-slate-200">
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${contact.fullName}`}
                        checked={selected.has(contact.externalId)}
                        onChange={() => toggle(contact.externalId)}
                      />
                    </td>
                    <td className="px-3 py-1.5 font-semibold text-slate-900 dark:text-white">{contact.fullName}</td>
                    <td className="px-3 py-1.5">{contact.jobTitle ?? "-"}</td>
                    <td className="px-3 py-1.5">{[contact.city, contact.country].filter(Boolean).join(", ") || "-"}</td>
                    <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">
                      {contact.emailStatus ?? "-"} / {contact.mobileStatus ?? "-"}
                    </td>
                    <td className="px-3 py-1.5">{STATUS_LABEL[contact.importStatus]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
