import { describe, expect, it } from "vitest";
import { COMPANY_LOCATION_REGIONS, inferCompanyRegion } from "@/lib/company-classification";

describe("company location classification", () => {
  it("keeps the supported region filters stable", () => {
    expect(COMPANY_LOCATION_REGIONS).toEqual([
      "Americas",
      "Europe",
      "Africa & Middle East",
      "Asia-Pacific",
    ]);
  });

  it.each([
    ["Bengaluru, India", "Asia-Pacific"],
    ["Shanghai, China", "Asia-Pacific"],
    ["Colombo, Sri Lanka", "Asia-Pacific"],
    ["Karachi, Pakistan", "Asia-Pacific"],
    ["Singapore", "Asia-Pacific"],
    ["Sydney, Australia", "Asia-Pacific"],
    ["New York, USA", "Americas"],
    ["Toronto, Canada", "Americas"],
    ["London, UK", "Europe"],
    ["Berlin, Germany", "Europe"],
    ["Dubai, UAE", "Africa & Middle East"],
    ["Riyadh, Saudi Arabia", "Africa & Middle East"],
    ["Johannesburg, South Africa", "Africa & Middle East"],
  ])("maps %s to %s", (headquarters, expectedRegion) => {
    expect(inferCompanyRegion(headquarters)).toBe(expectedRegion);
  });

  it("leaves unknown headquarters unclassified for audit-only backfills", () => {
    expect(inferCompanyRegion("Unknown")).toBeNull();
    expect(inferCompanyRegion(null)).toBeNull();
  });
});
