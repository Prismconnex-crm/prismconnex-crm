import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CompanyPeopleTable } from "@/components/crm/company-people-table";
import type { CompanyContact } from "@/lib/companies/company-contacts";

const base: CompanyContact = {
  fullName: "",
  company: "Acme",
  jobTitle: "Engineer",
  email: null,
  mobile: null,
  country: "United Kingdom",
  personLinkedInUrl: null,
  companyLinkedInUrl: "https://www.linkedin.com/company/acme/",
};

/** Class lists of the icon buttons (anchors and inert spans) inside the Contact LinkedIn cell of each row. */
function contactIconClasses(html: string): string[][] {
  // Array.from + [\s\S] rather than spread + the `s` flag: tsconfig sets no target.
  const rows = Array.from(html.matchAll(/<tr class="h-\[63px\][^"]*">([\s\S]*?)<\/tr>/g), (m) => m[1]);
  return rows.map((row) => {
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g), (m) => m[1]);
    const contactCell = cells[1];
    return Array.from(contactCell.matchAll(/<(?:a|span)[^>]*class="([^"]*size-9[^"]*)"/g), (m) => m[1]);
  });
}

const withoutCursor = (cls: string) =>
  cls
    .split(/\s+/)
    .filter((c) => !c.startsWith("cursor-"))
    .sort()
    .join(" ");

describe("company people table icons", () => {
  it("draws the contact LinkedIn and paper-plane identically whether or not a link or email exists", () => {
    const html = renderToStaticMarkup(
      <CompanyPeopleTable
        alwaysShowIcons
        contacts={[
          {
            ...base,
            fullName: "Revealed Person",
            email: "revealed@acme.com",
            personLinkedInUrl: "https://www.linkedin.com/in/revealed-person",
          },
          { ...base, fullName: "Hidden Person" },
        ]}
      />
    );
    const [revealed, hidden] = contactIconClasses(html);
    expect(revealed).toHaveLength(2); // LinkedIn + paper-plane
    expect(hidden).toHaveLength(2);
    // Same colour/border/background/opacity classes; only the cursor differs.
    expect(revealed.map(withoutCursor)).toEqual(hidden.map(withoutCursor));
    for (const cls of [...revealed, ...hidden]) {
      expect(cls).not.toMatch(/hover:|opacity-|text-slate-400|text-slate-500/);
    }
    // Contact LinkedIn is the official LinkedIn blue on both rows.
    expect(revealed[0]).toContain("text-[#0A66C2]");
    expect(hidden[0]).toContain("text-[#0A66C2]");
    // The linked row is still a real link; the other is not.
    expect(html).toContain('href="https://www.linkedin.com/in/revealed-person"');
    expect(html).toContain('aria-disabled="true"');
  });
});
