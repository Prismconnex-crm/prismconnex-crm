import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mocks the Postgres client the route actually uses. This suite previously
 * mocked "@/lib/db/sqlite-companies"; the discovery dataset moved to Postgres
 * ("DiscoveryCompany" via prisma.$queryRawUnsafe) and the mock stopped
 * intercepting anything, so every assertion here read an undefined call.
 */
const mocks = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
  },
}));

import { GET } from "@/app/api/companies/route";

const companyRow = {
  rowCursor: 4210,
  id: "company-1",
  workspaceId: "workspace-1",
  name: "APAC Software Co 123",
  category: "information technology & services",
  description: "Regional software provider",
  domain: "apac.example",
  website: "https://apac.example",
  founded: "2020",
  employeeRange: "1-10",
  headquarters: "Bengaluru, India",
  region: "Asia-Pacific",
  revenueRange: "Undisclosed",
  engagementScore: 88,
  trustSignals: "Verified",
  tags: "Verified",
  email: "hello@apac.example",
  phone: "+91 80 5555 0101",
  highlights: "APAC growth",
  insights: "High fit",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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
    expect(normalizeSql(sql)).toContain(
      `WHERE category = $1 AND "employeeRange" IN ($2) AND region = $3`
    );
    expect(normalizeSql(sql)).toContain(`ORDER BY "DiscoveryCompany"."rowCursor" DESC`);
    expect(params).toEqual(["information technology & services", "1-10", "Asia-Pacific", 31]);
  });

  it("uses indexed prefix ranges instead of contains search", async () => {
    const request = new Request("http://localhost/api/companies?search=apac&limit=5");

    const response = await GET(request);
    const [sql, ...params] = mocks.queryRawUnsafe.mock.calls[0];

    expect(response.status).toBe(200);
    // The pattern operators are what keep the text_pattern_ops index scannable;
    // a LIKE or a collation-aware >= would full-scan the dataset.
    expect(normalizeSql(sql)).toContain("WHERE lower(name) ~>=~ $1 AND lower(name) ~<~ $2");
    expect(normalizeSql(sql)).toContain("ORDER BY lower(name) USING ~<~");
    expect(params).toEqual(["apac", "apad", 6]);
  });

  it("lowercases the search term to match the lower(name) index expression", async () => {
    const request = new Request("http://localhost/api/companies?search=GOOGLE&limit=5");

    const response = await GET(request);
    const [sql, ...params] = mocks.queryRawUnsafe.mock.calls[0];

    expect(response.status).toBe(200);
    expect(normalizeSql(sql)).toContain("WHERE lower(name) ~>=~ $1 AND lower(name) ~<~ $2");
    // Bounds MUST be lowercased: they are compared against lower(name), so an
    // uppercase bound would sort outside the index range and match nothing.
    expect(params).toEqual(["google", "googlf", 6]);
  });
});
