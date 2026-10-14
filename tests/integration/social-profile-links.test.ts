import { describe, expect, it } from "vitest";
import { getSocialProfileLink } from "@/lib/integrations/social-profiles";

describe("social profile links", () => {
    it("opens the PrismConnex Instagram profile in a safe new tab", () => {
        expect(getSocialProfileLink("Instagram")).toEqual({
            href: "https://www.instagram.com/prismconnex/?hl=en",
            target: "_blank",
            rel: "noopener noreferrer",
        });
    });

    it("leaves other social providers as non-links", () => {
        expect(getSocialProfileLink("Facebook")).toBeNull();
    });
});
