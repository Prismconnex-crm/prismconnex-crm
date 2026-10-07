import { describe, expect, it } from "vitest";
import { safeReturnTo, signInHrefReturningTo } from "@/lib/auth/return-to";
import { exhibitorsContextUrl, readExhibitorsContext, withoutExhibitor } from "@/lib/find-shows/exhibitor-return";

// Returning to the page that asked a visitor to sign in — without ever becoming an open redirect.

describe("sign-in return path", () => {
  it("keeps a path on this site, with its query and hash", () => {
    expect(safeReturnTo("/find-shows/some-show?tab=exhibitors&exhibitor=abc")).toBe("/find-shows/some-show?tab=exhibitors&exhibitor=abc");
    expect(safeReturnTo("/en-US/find-shows/some-show?q=a%20b#top")).toBe("/en-US/find-shows/some-show?q=a%20b#top");
  });

  it("refuses anything that could leave the site", () => {
    for (const value of [
      "https://evil.example/",
      "//evil.example/path",
      "/\\evil.example",
      "\\\\evil.example",
      "/\t/evil.example",
      "javascript:alert(1)",
      "find-shows/relative",
      "",
      null,
      undefined,
      `/${"a".repeat(2001)}`,
    ]) {
      expect(safeReturnTo(value)).toBeNull();
    }
  });

  it("never returns into the auth pages or the API, so sign-in cannot loop", () => {
    expect(safeReturnTo("/auth/sign-in?returnTo=/x")).toBeNull();
    expect(safeReturnTo("/en-US/auth/sign-in")).toBeNull();
    expect(safeReturnTo("/api/auth/me")).toBeNull();
    expect(safeReturnTo("/authors")).toBe("/authors");
  });

  it("points at the existing sign-in page, forced, with the return attached", () => {
    const href = signInHrefReturningTo("/find-shows/some-show?tab=exhibitors&exhibitor=abc");
    const url = new URL(href, "https://prismconnex.test");
    expect(url.pathname).toBe("/auth/sign-in");
    expect(url.searchParams.get("forceSignIn")).toBe("1");
    expect(url.searchParams.get("returnTo")).toBe("/find-shows/some-show?tab=exhibitors&exhibitor=abc");
    expect(signInHrefReturningTo("https://evil.example/")).toBe("/auth/sign-in?forceSignIn=1");
  });
});

describe("exhibitors context in the event address", () => {
  it("round-trips the tab, search, letter and exhibitor, keeping other parameters", () => {
    const url = exhibitorsContextUrl("/find-shows/show", "?ref=mail&tab=about", { query: "solar & wind", letter: "#", exhibitorId: "card-7" });
    const [pathname, search] = url.split("?");
    expect(pathname).toBe("/find-shows/show");
    const params = new URLSearchParams(search);
    expect(params.get("ref")).toBe("mail");
    expect(params.get("tab")).toBe("exhibitors");
    expect(readExhibitorsContext(`?${search}`)).toEqual({ query: "solar & wind", letter: "#", exhibitorId: "card-7" });
  });

  it("ignores a letter that is not on the A–Z bar and an empty context", () => {
    expect(readExhibitorsContext("?letter=AB&q=")).toEqual({ query: "", letter: null, exhibitorId: null });
    expect(exhibitorsContextUrl("/find-shows/show", "", {})).toBe("/find-shows/show?tab=exhibitors");
  });

  it("drops only the exhibitor once its details have been handled", () => {
    expect(withoutExhibitor("/find-shows/show", "?tab=exhibitors&q=x&exhibitor=card-7")).toBe("/find-shows/show?tab=exhibitors&q=x");
    expect(withoutExhibitor("/find-shows/show", "?exhibitor=card-7")).toBe("/find-shows/show");
  });

  it("survives the trip through the sign-in page's return parameter", () => {
    const target = exhibitorsContextUrl("/fr/find-shows/show", "", { query: "café", letter: "C", exhibitorId: "x/y?z" });
    const back = new URL(signInHrefReturningTo(target), "https://prismconnex.test").searchParams.get("returnTo");
    expect(back).not.toBeNull();
    expect(readExhibitorsContext(new URL(back as string, "https://prismconnex.test").search)).toEqual({ query: "café", letter: "C", exhibitorId: "x/y?z" });
  });
});
