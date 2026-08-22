import { describe, it, expect } from "vitest";
import { UpdateProfessionalInfoSchema } from "@/models/profile";

/**
 * Cover for the four fields the Professional Information card gained:
 * company, bio, website and linkedinUrl.
 *
 * The website/LinkedIn pair is the part worth testing. People type
 * "linkedin.com/in/ada", not "https://linkedin.com/in/ada", and a column that
 * stores the bare form renders an <a href> the browser resolves as a RELATIVE
 * path — so the link silently points at /app/profile/linkedin.com/in/ada.
 * Normalising at the schema means the column only ever holds something a
 * browser will treat as absolute.
 *
 * The `javascript:` case is the security half: an unchecked href is a stored
 * XSS vector, and it must be rejected rather than normalised into something
 * that looks safe.
 */

/** The fields the card always submits, so each test states only what it varies. */
const BASE = {
    employeeId: null,
    department: null,
    designation: null,
    reportingManager: null,
    team: null,
    joiningDate: null,
    skills: [],
};

const parse = (patch: Record<string, unknown>) =>
    UpdateProfessionalInfoSchema.parse({ ...BASE, ...patch });

describe("UpdateProfessionalInfoSchema — company and bio", () => {
    it("accepts a company name", () => {
        expect(parse({ company: "Prismconnex GmbH" }).company).toBe("Prismconnex GmbH");
    });

    it("trims and maps an empty company to null", () => {
        expect(parse({ company: "   " }).company).toBeNull();
    });

    it("accepts a multi-line bio", () => {
        const bio = "Line one.\nLine two.";
        expect(parse({ bio }).bio).toBe(bio);
    });

    it("rejects a bio beyond 1000 characters", () => {
        expect(() => parse({ bio: "x".repeat(1001) })).toThrow();
    });
});

describe("UpdateProfessionalInfoSchema — website and linkedinUrl", () => {
    it("keeps an absolute https URL unchanged", () => {
        expect(parse({ website: "https://example.com/team" }).website).toBe(
            "https://example.com/team"
        );
    });

    it("keeps an absolute http URL unchanged", () => {
        expect(parse({ website: "http://example.com" }).website).toBe("http://example.com");
    });

    it("prefixes https:// on a bare host", () => {
        expect(parse({ website: "example.com" }).website).toBe("https://example.com");
    });

    it("prefixes https:// on a bare LinkedIn path", () => {
        expect(parse({ linkedinUrl: "linkedin.com/in/ada" }).linkedinUrl).toBe(
            "https://linkedin.com/in/ada"
        );
    });

    it("maps a cleared field to null", () => {
        expect(parse({ website: "" }).website).toBeNull();
        expect(parse({ linkedinUrl: "   " }).linkedinUrl).toBeNull();
    });

    it("rejects a javascript: URL rather than normalising it", () => {
        // eslint-disable-next-line no-script-url
        expect(() => parse({ website: "javascript:alert(1)" })).toThrow();
    });

    it("rejects a data: URL", () => {
        expect(() => parse({ website: "data:text/html,<script>alert(1)</script>" })).toThrow();
    });

    it("rejects a string with no host at all", () => {
        expect(() => parse({ website: "not a url" })).toThrow();
    });
});
