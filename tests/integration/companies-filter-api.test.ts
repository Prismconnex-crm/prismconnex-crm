import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: {
      count: mocks.count,
      findMany: mocks.findMany,
    },
  },
}));

import { GET } from "@/app/api/companies/route";

describe("companies filter API", () => {
  beforeEach(() => {
    mocks.count.mockReset();
    mocks.findMany.mockReset();
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([
      {
        id: "company-1",
        name: "APAC Software Co",
        category: "information technology & services",
        employeeRange: "1-10",
        region: "Asia-Pacific",
        tags: "Verified",
        highlights: "APAC growth",
        insights: "High fit",
      },
    ]);
  });

  it("passes category, employee range, and location into the Prisma where clause", async () => {
    const request = new Request(
      "http://localhost/api/companies?category=information%20technology%20%26%20services&employeeRange=1-10&location=Asia-Pacific"
    );

    const response = await GET(request);
    const body = await response.json();

    const where = {
      category: "information technology & services",
      employeeRange: "1-10",
      region: "Asia-Pacific",
    };

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(mocks.count).toHaveBeenCalledWith({ where });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: { engagementScore: "desc" },
        skip: 0,
        take: 50,
      })
    );
  });
});
