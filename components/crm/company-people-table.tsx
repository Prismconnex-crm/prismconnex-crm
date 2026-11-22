"use client";

import { Send } from "lucide-react";
import type { CompanyContact } from "@/lib/companies/company-contacts";

/**
 * People tab table for a company with an imported contact list
 * (see lib/companies/company-contacts.ts), matched to the 4Matrix People tab
 * reference: eight fixed columns, 36px icon buttons, contact LinkedIn (white
 * mark) beside a paper-plane message button, company LinkedIn in brand blue.
 *
 * Any field the source left empty renders as "-" — nothing is inferred. The
 * paper-plane only links out when the contact has a real messaging URL; no
 * imported source carries one yet, so it renders inert rather than linking
 * somewhere made up.
 */

const EMPTY = "-";

const COLUMNS = [
  "Full Name",
  "Contact LinkedIn",
  "Company",
  "Company LinkedIn",
  "Job Title",
  "Email ID",
  "Mobile Number",
  "Country",
] as const;

/**
 * One fixed look for every icon button, linked or not. The owner reported the
 * contact LinkedIn "lighting up" on rows with a revealed email: in practice the
 * only rows with both are directory contacts, and linked buttons used to be
 * drawn brighter (and hover-highlighted) than inert ones. Now colour, border,
 * background and opacity never depend on whether a URL or email exists — only
 * the cursor does.
 */
const ICON_BUTTON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-slate-200 bg-white dark:border-[#22304A] dark:bg-[#0B1220]";
const ICON_BUTTON_LIVE = "cursor-pointer";
const ICON_BUTTON_INERT = "cursor-default";
/**
 * LinkedIn mark colour — the official LinkedIn blue, used for both the contact
 * and the company icon (owner's 2026-11-22 spec), identical whether or not a
 * profile URL exists and whatever the email status.
 */
const CONTACT_LINKEDIN_COLOR = "text-[#0A66C2]";
/** Paper-plane colour — identical whether or not a messaging/email link exists. */
const PAPER_PLANE_COLOR = "text-slate-600 dark:text-slate-300";

function LinkedInGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2.4 9.5h5.16V21H2.4zM9.6 9.5h4.95v1.57h.07c.69-1.24 2.38-2.3 4.4-2.3 3.68 0 4.58 2.3 4.58 5.6V21h-5.16v-5.6c0-1.34-.03-3.07-1.95-3.07-1.96 0-2.26 1.46-2.26 2.97V21H9.6z" />
    </svg>
  );
}

function Empty() {
  return <span className="text-slate-400 dark:text-slate-500">{EMPTY}</span>;
}

function LinkedInButton({ url, label }: { url: string; label: string; brand?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={`${ICON_BUTTON} ${ICON_BUTTON_LIVE} ${CONTACT_LINKEDIN_COLOR}`}
    >
      <LinkedInGlyph />
    </a>
  );
}

/** LinkedIn mark with no link behind it — same button, same colour, just not clickable. */
function LinkedInUnavailable({ name }: { name: string }) {
  return (
    <span
      aria-disabled="true"
      title={`No LinkedIn profile available for ${name}`}
      className={`${ICON_BUTTON} ${ICON_BUTTON_INERT} ${CONTACT_LINKEDIN_COLOR}`}
    >
      <LinkedInGlyph />
    </span>
  );
}

function MessageButton({ url, name }: { url: string | null; name: string }) {
  if (!url) {
    return (
      <span
        aria-disabled="true"
        title={`No messaging link available for ${name}`}
        className={`${ICON_BUTTON} ${ICON_BUTTON_INERT} ${PAPER_PLANE_COLOR}`}
      >
        <Send className="size-4" strokeWidth={1.75} />
      </span>
    );
  }
  // mailto: hands off to the viewer's mail app (nothing is sent); a new tab
  // would only leave a blank page behind.
  const isMail = url.startsWith("mailto:");
  const label = isMail ? `Email ${name}` : `Message ${name}`;
  return (
    <a
      href={url}
      {...(isMail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      title={label}
      aria-label={label}
      className={`${ICON_BUTTON} ${ICON_BUTTON_LIVE} ${PAPER_PLANE_COLOR}`}
    >
      <Send className="size-4" strokeWidth={1.75} />
    </a>
  );
}

const CELL = "whitespace-nowrap px-4 text-[13px] font-medium text-slate-700 dark:text-slate-200";

export function CompanyPeopleTable({
  contacts,
  alwaysShowIcons = false,
}: {
  contacts: CompanyContact[];
  /** Keep both contact icons on rows without a LinkedIn URL (inert) instead of "-". */
  alwaysShowIcons?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-left">
          <thead className="bg-slate-50 dark:bg-[#0B1220]">
            <tr className="border-b border-slate-200 dark:border-[#22304A]">
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap px-4 py-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1A2740]">
            {contacts.map((contact, index) => (
              <tr
                key={`${contact.fullName}-${contact.email ?? ""}-${index}`}
                className="h-[63px] transition-colors hover:bg-slate-50 dark:hover:bg-[#16233A]"
              >
                <td className="whitespace-nowrap px-4 text-[13px] font-bold text-slate-900 dark:text-white">
                  {contact.fullName}
                </td>
                <td className="px-4">
                  {contact.personLinkedInUrl || alwaysShowIcons ? (
                    <div className="flex items-center gap-2">
                      {contact.personLinkedInUrl ? (
                        <LinkedInButton url={contact.personLinkedInUrl} label={`${contact.fullName} on LinkedIn`} />
                      ) : (
                        <LinkedInUnavailable name={contact.fullName} />
                      )}
                      <MessageButton url={contact.messagingUrl ?? null} name={contact.fullName} />
                    </div>
                  ) : (
                    <Empty />
                  )}
                </td>
                <td className={CELL}>{contact.company ?? <Empty />}</td>
                <td className="px-4">
                  {contact.companyLinkedInUrl ? (
                    <LinkedInButton
                      url={contact.companyLinkedInUrl}
                      label={`${contact.company ?? "Company"} on LinkedIn`}
                      brand
                    />
                  ) : (
                    <Empty />
                  )}
                </td>
                <td className={`${CELL} max-w-[280px] truncate`} title={contact.jobTitle ?? undefined}>
                  {contact.jobTitle ?? <Empty />}
                </td>
                <td className={CELL}>
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="hover:text-indigo-600 dark:hover:text-indigo-300">
                      {contact.email}
                    </a>
                  ) : (
                    <Empty />
                  )}
                </td>
                <td className={CELL}>
                  {contact.mobile ? (
                    <a
                      href={`tel:${contact.mobile.replace(/[^\d+]/g, "")}`}
                      className="hover:text-indigo-600 dark:hover:text-indigo-300"
                    >
                      {contact.mobile}
                    </a>
                  ) : (
                    <Empty />
                  )}
                </td>
                <td className={CELL}>{contact.country ?? <Empty />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
