import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
  },
}));

import { GET } from "@/app/api/companies/route";

// Mirrors the columns LIST_COLUMNS actually selects from "DiscoveryCompany".
const companyRow = {
  rowCursor: 4242,
  id: "company-1",
  name: "APAC Software Co 123",
  category: "information technology & services",
  domain: "apac.example",
  founded: "2020",
  employeeRange: "1-10",
  headquarters: "Bengaluru, India",
  region: "Asia-Pacific",
  engagementScore: 88,
  tags: "Verified",
  highlights: "APAC growth",
  insights: "High fit",
  email: "hello@apac.example",
  phone: "+91 80 5555 0101",
};

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

describe("companies filter API", () => {
  beforeEach(() => {
    mocks.queryRawUnsafe.mockReset();
    mocks.queryRawUnsafe.mockResolvedValue([companyRow]);
  });

  it("uses raw SQL with exact filters, rowCursor listing, and cursor-compatible limit", async () => {
    const request = new Request(
      "http://localhost/api/companies?category=information%20technology%20%26%20services&employeeRange=1-10&location=Asia-Pacific"
    );

    const response = await GET(request);
    const body = await response.json();
    const [sql, ...params] = mocks.queryRawUnsafe.mock.calls[0];

    expect(response.status).toBe(200);
    expect(body.total).toBeNull();
    expect(body.pagination).toBe("cursor");
    expect(body.hasNextPage).toBe(false);
    expect(body.companies[0].name).toBe("APAC Software Co");
    // Category is matched over its spelling variants, not by a single equality:
    // the dataset holds both "information technology & services" and the title
    // -cased form, and an IN list keeps the composite index usable where
    // lower(category) = $1 would not.
    expect(normalizeSql(sql)).toContain(
      `WHERE category IN ($1,$2) AND "employeeRange" IN ($3) AND region = $4`
    );
    expect(normalizeSql(sql)).toContain(`ORDER BY "DiscoveryCompany"."rowCursor" DESC`);
    expect(params).toEqual([
      "information technology & services",
      "Information Technology & Services",
      "1-10",
      "Asia-Pacific",
      31,
    ]);
  });

  it("uses indexed prefix ranges instead of contains search", async () => {
    const request = new Request("http://localhost/api/companies?search=apac&limit=5");

    const response = await GET(request);
    const [sql, ...params] = mocks.queryRawUnsafe.mock.calls[0];

    expect(response.status).toBe(200);
    expect(normalizeSql(sql)).toContain("WHERE lower(name) ~>=~ $1 AND lower(name) ~<~ $2");
    expect(normalizeSql(sql)).toContain("ORDER BY lower(name) USING ~<~");
    expect(params).toEqual(["apac", "apad", 6]);
  });

  it("lowercases the search term so uppercase input still matches Titlecase names", async () => {
    const request = new Request("http://localhost/api/companies?search=GOOGLE&limit=5");

    const response = await GET(request);
    const [sql, ...params] = mocks.queryRawUnsafe.mock.calls[0];

    expect(response.status).toBe(200);
    expect(normalizeSql(sql)).toContain("WHERE lower(name) ~>=~ $1 AND lower(name) ~<~ $2");
    // Both sides of the comparison must be lowercase to use the lower(name)
    // text_pattern_ops index; the bound is the term with its last char bumped.
    expect(params).toEqual(["google", "googlf", 6]);
  });
});
