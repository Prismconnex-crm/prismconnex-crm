import { describe, expect, it } from "vitest";
import {
  extractEmailDomain,
  isFreeEmailProvider,
  companyDomainFromEmail,
} from "@/lib/auth/email-domain";

describe("extractEmailDomain", () => {
  it.each([
    ["john@google.com", "google.com"],
    ["alice@microsoft.com", "microsoft.com"],
    ["ranjith@fidensgen.com", "fidensgen.com"],
  ])("extracts the domain from %s", (email, expected) => {
    expect(extractEmailDomain(email)).toBe(expected);
  });

  it("lowercases and trims", () => {
    expect(extractEmailDomain("  John@Google.COM  ")).toBe("google.com");
  });

  it("keeps subdomains, which are legitimate corporate hosts", () => {
    expect(extractEmailDomain("dev@mail.corp.google.com")).toBe("mail.corp.google.com");
  });

  it("uses the last @ so quoted local parts do not confuse it", () => {
    expect(extractEmailDomain('"odd@name"@example.com')).toBe("example.com");
  });

  it("strips a trailing dot from a fully qualified domain", () => {
    expect(extractEmailDomain("john@google.com.")).toBe("google.com");
  });

  it.each([
    ["", "empty string"],
    ["   ", "whitespace"],
    ["notanemail", "no @"],
    ["john@", "nothing after the @"],
    ["@google.com", "nothing before the @"],
    ["john@localhost", "no dot in the host"],
    ["john@goo gle.com", "space in the host"],
    ["john@-google.com", "host label starting with a hyphen"],
    ["john@google..com", "empty host label"],
  ])("returns null for %s (%s)", (email) => {
    expect(extractEmailDomain(email)).toBeNull();
  });
});

describe("isFreeEmailProvider", () => {
  it.each([
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.in",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "aol.com",
    "proton.me",
    "protonmail.com",
    "zoho.com",
    "mail.com",
    "rediffmail.com",
    "yandex.com",
  ])("treats %s as a personal mailbox", (domain) => {
    expect(isFreeEmailProvider(domain)).toBe(true);
  });

  it.each(["google.com", "microsoft.com", "fidensgen.com", "amazon.com"])(
    "treats %s as a corporate domain",
    (domain) => {
      expect(isFreeEmailProvider(domain)).toBe(false);
    }
  );

  it("is case insensitive", () => {
    expect(isFreeEmailProvider("GMAIL.COM")).toBe(true);
  });
});

describe("companyDomainFromEmail", () => {
  it("returns the domain for a corporate address", () => {
    expect(companyDomainFromEmail("john@google.com")).toBe("google.com");
  });

  it("returns null for a personal mailbox, so gmail.com never matches Google", () => {
    expect(companyDomainFromEmail("john@gmail.com")).toBeNull();
  });

  it("returns null for an unparseable address", () => {
    expect(companyDomainFromEmail("still-typing@")).toBeNull();
  });
});
