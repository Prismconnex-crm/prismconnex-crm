import { describe, expect, it, vi } from "vitest";
import { ProspeoError, searchAllPeople, searchPersonPage, type ProspeoSearchResult } from "@/lib/prospeo/client";
import { linkedInProfileKey, mapProspeoResult } from "@/lib/prospeo/map";
import { prospeoTargetFor, resultBelongsTo, searchFiltersFor } from "@/lib/prospeo/pilot";
import { planImport, type ExistingContactRow } from "@/lib/prospeo/import-plan";
import {
  importProspeo,
  previewProspeo,
  ProspeoNotConfiguredError,
  ProspeoNotEnabledError,
  type ContactStore,
} from "@/lib/prospeo/service";
import { getCompanyContacts } from "@/lib/companies/company-contacts";

const IRIS_ID = "8cb2c9ff-53d5-4867-b666-f414a440218d";
const WIRIS_ID = "b43ff7c9-7308-433d-85e4-a5b6a7466e47";
const noSleep = async () => {};

const irisCompany = {
  company_id: "c-iris",
  name: "IRIS Software Group",
  website: "https://www.iris.co.uk",
  domain: "iris.co.uk",
  linkedin_url: "https://www.linkedin.com/company/iriseducation",
  industry: "Software Development",
  employee_count: 3200,
};

function person(id: string, name: string, extra: Record<string, unknown> = {}): ProspeoSearchResult {
  return {
    person: {
      person_id: id,
      full_name: name,
      linkedin_url: `https://www.linkedin.com/in/${name.toLowerCase().replace(/\s+/g, "-")}`,
      current_job_title: "Account Manager",
      job_history: [{ current: true, seniority: "Senior", title: "Account Manager" }],
      location: { country: "United Kingdom", city: "Reading" },
      email: { status: "VERIFIED", revealed: false, email: "a*****@iris.co.uk" },
      mobile: { status: "UNAVAILABLE", revealed: false, mobile: null },
      ...extra,
    },
    company: irisCompany,
  };
}

/** A fake Prospeo server: pages of results, optional scripted failures first. */
function fakeProspeo(pages: ProspeoSearchResult[][], opts: { failures?: Array<{ status: number; body: unknown }>; free?: boolean } = {}) {
  const failures = [...(opts.failures ?? [])];
  const calls: Array<{ url: string; headers: Record<string, string>; body: { page: number; filters: unknown } }> = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, headers: init.headers as Record<string, string>, body });
    const failure = failures.shift();
    if (failure) return new Response(JSON.stringify(failure.body), { status: failure.status });
    const results = pages[body.page - 1] ?? [];
    if (results.length === 0) return new Response(JSON.stringify({ error: true, error_code: "NO_RESULTS" }), { status: 400 });
    const total = pages.reduce((n, p) => n + p.length, 0);
    return new Response(
      JSON.stringify({
        error: false,
        free: opts.free ?? false,
        results,
        pagination: { current_page: body.page, per_page: 25, total_page: pages.length, total_count: total },
      }),
      { status: 200 }
    );
  });
  return { fetchImpl, calls };
}

/** In-memory ExhibitorContact store honouring the (exhibitorId, source, externalId) unique index. */
function memoryStore() {
  const rows: Array<Record<string, unknown>> = [];
  let seq = 0;
  const store: ContactStore = {
    exhibitorContact: {
      async findMany({ where }) {
        return rows.filter((r) => r.exhibitorId === where.exhibitorId && (!where.source || r.source === where.source));
      },
      async createMany({ data, skipDuplicates }) {
        let count = 0;
        for (const row of data) {
          const clash = rows.some(
            (r) => r.exhibitorId === row.exhibitorId && r.source === row.source && r.externalId === row.externalId
          );
          if (clash) {
            if (skipDuplicates) continue;
            throw new Error("unique violation");
          }
          rows.push({ ...row, id: `row-${++seq}` });
          count += 1;
        }
        return { count };
      },
      async update({ where, data }) {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      },
    },
  };
  return { store, rows };
}

describe("Prospeo client", () => {
  it("authenticates with X-KEY and filters by the company website", async () => {
    const { fetchImpl, calls } = fakeProspeo([[person("p1", "Ann Lee")]]);
    await searchPersonPage({ company: { websites: { include: ["iris.co.uk"] } } }, 1, { apiKey: "k-123", fetchImpl });
    expect(calls[0].url).toBe("https://api.prospeo.io/search-person");
    expect(calls[0].headers["X-KEY"]).toBe("k-123");
    expect(calls[0].body).toEqual({ page: 1, filters: { company: { websites: { include: ["iris.co.uk"] } } } });
  });

  it("fetches every page and counts only charged pages as credits", async () => {
    const pages = [
      Array.from({ length: 25 }, (_, i) => person(`a${i}`, `Person A${i}`)),
      Array.from({ length: 25 }, (_, i) => person(`b${i}`, `Person B${i}`)),
      [person("c0", "Person C0")],
    ];
    const { fetchImpl, calls } = fakeProspeo(pages);
    const all = await searchAllPeople({}, { apiKey: "k", fetchImpl, sleep: noSleep });
    expect(calls.map((c) => c.body.page)).toEqual([1, 2, 3]);
    expect(all.results).toHaveLength(51);
    expect(all.totalCount).toBe(51);
    expect(all.creditsUsed).toBe(3);
    expect(all.truncated).toBe(false);

    const repeat = await searchAllPeople({}, { apiKey: "k", fetchImpl: fakeProspeo(pages, { free: true }).fetchImpl, sleep: noSleep });
    expect(repeat.creditsUsed).toBe(0); // within-30-days repeats are free
  });

  it("stops at maxPages and reports truncation", async () => {
    const pages = [[person("a", "A A")], [person("b", "B B")], [person("c", "C C")]];
    const all = await searchAllPeople({}, { apiKey: "k", fetchImpl: fakeProspeo(pages).fetchImpl, sleep: noSleep, maxPages: 2 });
    expect(all.pagesFetched).toBe(2);
    expect(all.truncated).toBe(true);
  });

  it("retries rate limits and temporary errors, then succeeds", async () => {
    const { fetchImpl, calls } = fakeProspeo([[person("p1", "Ann Lee")]], {
      failures: [
        { status: 429, body: { error: true, error_code: "Rate limit exceeded" } },
        { status: 400, body: { error: true, error_code: "SERVICE_TEMPORARILY_UNAVAILABLE" } },
      ],
    });
    const sleep = vi.fn(noSleep);
    const page = await searchPersonPage({}, 1, { apiKey: "k", fetchImpl, sleep });
    expect(page.results).toHaveLength(1);
    expect(calls).toHaveLength(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("fails fast on a bad key and treats NO_RESULTS as an empty result", async () => {
    const bad = fakeProspeo([], { failures: [{ status: 400, body: { error: true, error_code: "INVALID_API_KEY" } }] });
    await expect(searchPersonPage({}, 1, { apiKey: "x", fetchImpl: bad.fetchImpl, sleep: noSleep })).rejects.toMatchObject({
      code: "INVALID_API_KEY",
    });
    expect(bad.calls).toHaveLength(1);

    const none = await searchAllPeople({}, { apiKey: "k", fetchImpl: fakeProspeo([]).fetchImpl, sleep: noSleep });
    expect(none).toMatchObject({ results: [], totalCount: 0, creditsUsed: 0 });
    expect(new ProspeoError("X", "m")).toBeInstanceOf(Error);
  });
});

describe("Prospeo mapping", () => {
  it("maps fields and never stores masked or unrevealed emails/mobiles", () => {
    const contact = mapProspeoResult(person("p1", "Ann Lee"))!;
    expect(contact).toMatchObject({
      externalId: "p1",
      fullName: "Ann Lee",
      personLinkedInUrl: "https://www.linkedin.com/in/ann-lee",
      linkedinKey: "ann-lee",
      companyName: "IRIS Software Group",
      companyLinkedInUrl: "https://www.linkedin.com/company/iriseducation",
      companyDomain: "iris.co.uk",
      jobTitle: "Account Manager",
      email: null,
      emailStatus: "VERIFIED",
      mobile: null,
      mobileStatus: "UNAVAILABLE",
      country: "United Kingdom",
      city: "Reading",
      seniority: "Senior",
      industry: "Software Development",
      companySize: 3200,
    });
    // Even "revealed" but masked values are rejected.
    expect(
      mapProspeoResult(person("p2", "Bo Ray", { email: { status: "VERIFIED", revealed: true, email: "b.*****@iris.co.uk" } }))!.email
    ).toBeNull();
    expect(
      mapProspeoResult(person("p3", "Cy Dee", { email: { status: "VERIFIED", revealed: true, email: "cy.dee@iris.co.uk" } }))!.email
    ).toBe("cy.dee@iris.co.uk");
    expect(mapProspeoResult({ person: { full_name: "No Id" }, company: null })).toBeNull();
    expect(linkedInProfileKey("https://uk.linkedin.com/in/Ann-Lee/?x=1")).toBe("ann-lee");
  });
});

describe("Prospeo pilot gate", () => {
  it("is enabled for IRIS Education only and searches by its exact domain", () => {
    const target = prospeoTargetFor(IRIS_ID)!;
    expect(target).toMatchObject({ companyName: "IRIS Education", domain: "iris.co.uk" });
    expect(searchFiltersFor(target)).toEqual({ company: { websites: { include: ["iris.co.uk"], exclude: [] } } });
    expect(prospeoTargetFor(WIRIS_ID)).toBeNull();
    expect(prospeoTargetFor("anything-else")).toBeNull();
  });

  it("accepts results only from IRIS's domain or LinkedIn page, not similarly named companies", () => {
    const target = prospeoTargetFor(IRIS_ID)!;
    expect(resultBelongsTo(person("p1", "Ann Lee"), target)).toBe(true);
    expect(
      resultBelongsTo({ person: { person_id: "x" }, company: { name: "IRIS", domain: "other.com", linkedin_url: "https://www.linkedin.com/company/iriseducation/" } }, target)
    ).toBe(true);
    expect(resultBelongsTo({ person: { person_id: "x" }, company: { name: "IRIS Tech", domain: "irisdra.com" } }, target)).toBe(false);
    expect(resultBelongsTo({ person: { person_id: "x" }, company: { name: "IRIS Inspection Machines", website: "https://www.iris-im.com" } }, target)).toBe(false);
    expect(resultBelongsTo({ person: { person_id: "x" }, company: null }, target)).toBe(false);
  });
});

describe("Prospeo import plan", () => {
  const existingRow = (over: Partial<ExistingContactRow>): ExistingContactRow => ({
    id: "row-1",
    externalId: "p1",
    fullName: "Ann Lee",
    personLinkedInUrl: "https://www.linkedin.com/in/ann-lee",
    linkedinKey: "ann-lee",
    companyName: "IRIS Software Group",
    companyLinkedInUrl: "https://www.linkedin.com/company/iriseducation",
    jobTitle: "Account Manager",
    email: "ann@iris.co.uk", // entered/revealed earlier
    emailStatus: "VERIFIED",
    mobile: null,
    mobileStatus: "UNAVAILABLE",
    country: "United Kingdom",
    city: "Reading",
    seniority: "Senior",
    industry: "Software Development",
    companySize: 3200,
    ...over,
  });

  it("creates new people, leaves unchanged ones, and never wipes stored values with empties", () => {
    const plan = planImport([existingRow({})], [mapProspeoResult(person("p1", "Ann Lee"))!, mapProspeoResult(person("p2", "Bo Ray"))!]);
    expect(plan.create.map((c) => c.externalId)).toEqual(["p2"]);
    expect(plan.unchanged.map((c) => c.externalId)).toEqual(["p1"]); // email kept: incoming null is not a change
    expect(plan.update).toHaveLength(0);
  });

  it("updates only changed non-empty fields", () => {
    const moved = mapProspeoResult(person("p1", "Ann Lee", { current_job_title: "Head of Sales" }))!;
    const plan = planImport([existingRow({})], [moved]);
    expect(plan.update).toEqual([
      { id: "row-1", externalId: "p1", fullName: "Ann Lee", changes: { jobTitle: "Head of Sales" }, adoptExternalId: false },
    ]);
  });

  it("matches by LinkedIn when the id is unknown, records the id, and drops in-batch repeats", () => {
    const plan = planImport(
      [existingRow({ externalId: null })],
      [mapProspeoResult(person("p1", "Ann Lee"))!, mapProspeoResult(person("p1", "Ann Lee"))!]
    );
    expect(plan.create).toHaveLength(0);
    expect(plan.update).toHaveLength(1);
    expect(plan.update[0]).toMatchObject({ externalId: "p1", adoptExternalId: true });
    expect(plan.duplicates).toEqual([{ externalId: "p1", fullName: "Ann Lee" }]);
  });
});

describe("Prospeo pilot workflow", () => {
  const pages = [
    [
      person("p1", "Ann Lee"),
      person("p2", "Bo Ray"),
      // Same search, different company — must never reach IRIS's People tab.
      { person: { person_id: "x1", full_name: "Zed Other" }, company: { name: "Iris Solar", domain: "irissolar.com" } },
    ],
  ];

  it("refuses without an API key and for non-pilot exhibitors", async () => {
    const { store } = memoryStore();
    await expect(previewProspeo(IRIS_ID, { apiKey: "", db: store })).rejects.toBeInstanceOf(ProspeoNotConfiguredError);
    await expect(previewProspeo(WIRIS_ID, { apiKey: "k", db: store })).rejects.toBeInstanceOf(ProspeoNotEnabledError);
  });

  it("previews without writing, imports approved people, and is safe to re-run", async () => {
    const { store, rows } = memoryStore();
    const deps = { apiKey: "k", fetchImpl: fakeProspeo(pages).fetchImpl, sleep: noSleep, db: store };

    const preview = await previewProspeo(IRIS_ID, deps);
    expect(rows).toHaveLength(0);
    expect(preview.totalCount).toBe(3);
    expect(preview.contacts.map((c) => [c.fullName, c.importStatus])).toEqual([
      ["Ann Lee", "new"],
      ["Bo Ray", "new"],
    ]);
    expect(preview.otherCompany).toEqual([{ fullName: "Zed Other", companyName: "Iris Solar", companyDomain: "irissolar.com" }]);
    expect(preview.creditsUsed).toBe(1);

    // Approve only Ann; a forged id for the other-company person is ignored.
    const first = await importProspeo(IRIS_ID, ["p1", "x1"], deps);
    expect(first).toMatchObject({ imported: 1, updated: 0, unchanged: 0, duplicates: 0, skipped: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ exhibitorId: IRIS_ID, source: "prospeo", externalId: "p1", fullName: "Ann Lee", email: null });

    // Re-run (e.g. after an interruption): nothing duplicated.
    const again = await importProspeo(IRIS_ID, ["p1", "p2"], deps);
    expect(again).toMatchObject({ imported: 1, unchanged: 1, duplicates: 0 });
    expect(rows.map((r) => r.externalId).sort()).toEqual(["p1", "p2"]);
    expect(rows.every((r) => r.exhibitorId === IRIS_ID)).toBe(true);
  });
});

describe("IRIS Education People tab list", () => {
  const irisDirectory = {
    companyName: "IRIS Education",
    firstName: "Matt",
    lastName: "Brown",
    designation: "Sales Manager",
    email: "matt.brown@iris.co.uk",
    phone: "44 344 815 5555",
    country: "United Kingdom",
    personLinkedInUrl: "https://www.linkedin.com/in/matt-brown-a01277114",
    companyLinkedInUrl: "https://www.linkedin.com/company/iriseducation/",
  };

  it("lists the 15 people from IRIS_Education_Contacts.csv with the owner's mobile (2026-11-23)", () => {
    const contacts = getCompanyContacts("iris.co.uk", irisDirectory)!;
    expect(contacts).toHaveLength(15);
    expect(contacts[0].fullName).toBe("Bradley Allen");
    expect(contacts.every((c) => c.mobile === "44 344 815 5555")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Matt Brown")).toMatchObject({
      email: "matt.brown@iris.co.uk",
      personLinkedInUrl: "https://www.linkedin.com/in/matt-brown-a01277114",
    });
  });

  it("appends Prospeo imports after the file's people without repeating anyone", () => {
    const imported = [
      {
        fullName: "Ann Lee",
        company: "IRIS Software Group",
        jobTitle: "Account Manager",
        email: null,
        mobile: null,
        country: "United Kingdom",
        personLinkedInUrl: "https://www.linkedin.com/in/ann-lee",
        companyLinkedInUrl: "https://www.linkedin.com/company/iriseducation",
        emailStatus: "VERIFIED",
        mobileStatus: "UNAVAILABLE",
      },
      {
        fullName: "Matt Brown",
        company: "IRIS Software Group",
        jobTitle: "Sales Manager",
        email: null,
        mobile: null,
        country: "United Kingdom",
        personLinkedInUrl: "https://www.linkedin.com/in/matt-brown-a01277114",
        companyLinkedInUrl: null,
        emailStatus: "VERIFIED",
        mobileStatus: null,
      },
    ];
    const contacts = getCompanyContacts("iris.co.uk", irisDirectory, imported)!;
    // 15 from the CSV + Ann Lee; Prospeo's Matt Brown is already in the CSV.
    expect(contacts).toHaveLength(16);
    expect(contacts.filter((c) => c.fullName === "Matt Brown")).toHaveLength(1);
    expect(contacts[15]).toMatchObject({ fullName: "Ann Lee", email: null, emailStatus: "VERIFIED", mobileStatus: "UNAVAILABLE" });
    // Directory email fills Matt's empty email; the paper-plane becomes a mailto.
    expect(contacts.find((c) => c.fullName === "Matt Brown")).toMatchObject({
      email: "matt.brown@iris.co.uk",
      messagingUrl: "mailto:matt.brown@iris.co.uk",
    });
    expect(contacts.every((c) => c.companyLinkedInUrl)).toBe(true);
  });

  it("leaves every other company's list unchanged when no extras are passed", () => {
    expect(getCompanyContacts("acer.com")!.length).toBe(25);
  });
});
