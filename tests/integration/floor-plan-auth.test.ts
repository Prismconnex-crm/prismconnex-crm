import { describe, expect, it } from "vitest";
import { RETURN_TO_QUERY_PARAM, safeReturnTo, signInHrefReturningTo } from "@/lib/auth/return-to";
import { findShowEvents } from "@/lib/find-shows/catalog";
import { FLOOR_PLAN_TAB, floorPlanTabUrl, opensFloorPlan } from "@/lib/find-shows/floor-plan-return";

/** Where the sign-in page sends the visitor afterwards, as it reads its own address. */
const returnOf = (href: string) => safeReturnTo(new URL(href, "https://prismconnex.example").searchParams.get(RETURN_TO_QUERY_PARAM));

describe("Floor Plan tab in the event address", () => {
  it("opens the Floor Plan tab, keeping other parameters and replacing another tab", () => {
    const url = floorPlanTabUrl("/en-US/find-shows/bett-london-2027-01-20", "?tab=exhibitors&floorPlanDebug=1");
    const [, search] = url.split("?");
    expect(new URLSearchParams(search).get("tab")).toBe(FLOOR_PLAN_TAB);
    expect(new URLSearchParams(search).get("floorPlanDebug")).toBe("1");
    expect(opensFloorPlan(`?${search}`)).toBe(true);
    expect(floorPlanTabUrl("/find-shows/x", "")).toBe("/find-shows/x?tab=floor-plan");
  });

  it("only the floor-plan tab parameter opens it", () => {
    expect(opensFloorPlan("")).toBe(false);
    expect(opensFloorPlan("?tab=exhibitors")).toBe(false);
    expect(opensFloorPlan("?tab=floor-plan")).toBe(true);
  });
});

describe("Floor Plan sign-in return", () => {
  it("sends a signed-out visitor to the existing sign-in page, returning to the same event's Floor Plan", () => {
    const back = floorPlanTabUrl("/en-US/find-shows/bett-london-2027-01-20", "");
    const href = signInHrefReturningTo(back);
    expect(href.startsWith("/auth/sign-in?")).toBe(true);
    expect(returnOf(href)).toBe("/en-US/find-shows/bett-london-2027-01-20?tab=floor-plan");
  });

  it("works the same for every catalog event, whatever its floor-plan record says (or whether it has one yet)", () => {
    expect(findShowEvents.length).toBeGreaterThan(0);
    for (const event of findShowEvents) {
      for (const pathname of [`/find-shows/${event.slug}`, `/de-DE/find-shows/${event.slug}`]) {
        const back = floorPlanTabUrl(pathname, "");
        expect(returnOf(signInHrefReturningTo(back))).toBe(back);
      }
    }
  });

  it("works for an event added to the catalog later", () => {
    const back = floorPlanTabUrl("/fr-FR/find-shows/a-show-added-next-year-paris-2028-03-01", "");
    expect(returnOf(signInHrefReturningTo(back))).toBe(back);
  });
});
