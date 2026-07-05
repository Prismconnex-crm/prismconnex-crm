import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureSQLiteReadPragmas: vi.fn(),
  queryRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/db/sqlite-companies", () => ({
  ensureSQLiteReadPragmas: mocks.ensureSQLiteReadPragmas,
  prisma: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
  },
}));

import { GET } from "@/app/api/companies/route";

const companyRow = {
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
    mocks.ensureSQLiteReadPragmas.mockReset();
    mocks.queryRawUnsafe.mockReset();
    mocks.ensureSQLiteReadPragmas.mockResolvedValue(undefined);
    mocks.queryRawUnsafe.mockResolvedValue([companyRow]);
  });

  it("uses raw SQL with exact filters, rowid listing, and cursor-compatible limit", async () => {
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
      "WHERE category = ? AND employeeRange = ? AND region = ?"
    );
    expect(normalizeSql(sql)).toContain("ORDER BY rowid DESC");
    expect(params).toEqual(["information technology & services", "1-10", "Asia-Pacific", 31]);
  });

  it("uses indexed prefix ranges instead of contains search", async () => {
    const request = new Request("http://localhost/api/companies?search=apac&limit=5");

    const response = await GET(request);
    const [sql, ...params] = mocks.queryRawUnsafe.mock.calls[0];

    expect(response.status).toBe(200);
    expect(normalizeSql(sql)).toContain("WHERE name >= ? COLLATE NOCASE AND name < ? COLLATE NOCASE");
    expect(normalizeSql(sql)).toContain("ORDER BY name COLLATE NOCASE ASC");
    expect(params).toEqual(["apac", "apad", 6]);
  });

  it("preserves the raw search term casing so COLLATE NOCASE matches Titlecase names", async () => {
    const request = new Request("http://localhost/api/companies?search=GOOGLE&limit=5");

    const response = await GET(request);
    const [sql, ...params] = mocks.queryRawUnsafe.mock.calls[0];

    expect(response.status).toBe(200);
    expect(normalizeSql(sql)).toContain("WHERE name >= ? COLLATE NOCASE AND name < ? COLLATE NOCASE");
    expect(params).toEqual(["GOOGLE", "GOOGLF", 6]);
  });
});
