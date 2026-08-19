import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserAvatar } from "@/components/app-shell/user-avatar";

/**
 * Cover for the topbar avatar's three states.
 *
 * Rendered to static markup rather than driven in a browser: the whole point of
 * this component is WHICH branch it picks for a given src, and that decision is
 * visible in the first paint. The onLoad/onError transitions are React state on
 * top of these, and jsdom is not installed.
 *
 * The rule being protected: a user with no photo, and a user whose stored
 * avatar_url no longer resolves, must both end up looking at their initials —
 * never at a broken-image glyph.
 */

const PNG =
    "https://project-ref.supabase.co/storage/v1/object/public/avatars/user-id/photo.png";

describe("UserAvatar", () => {
    it("renders initials and no <img> when there is no photo", () => {
        const html = renderToStaticMarkup(
            <UserAvatar src={null} initials="RM" size={36} />
        );

        expect(html).toContain("RM");
        expect(html).not.toContain("<img");
    });

    it("renders the uploaded photo when one is stored", () => {
        const html = renderToStaticMarkup(
            <UserAvatar src={PNG} initials="RM" size={36} />
        );

        expect(html).toContain("<img");
        expect(html).toContain("photo.png");
    });

    it("keeps initials underneath while the photo is still loading", () => {
        // Both are present on first paint: the image starts at opacity-0 and the
        // initials layer covers it, so there is never an empty circle.
        const html = renderToStaticMarkup(
            <UserAvatar src={PNG} initials="RM" size={36} />
        );

        expect(html).toContain("opacity-0");
        expect(html).toContain("animate-pulse");
        expect(html).toContain("RM");
    });

    it("honours the requested diameter for both the trigger and the dropdown", () => {
        expect(
            renderToStaticMarkup(<UserAvatar src={null} initials="RM" size={36} />)
        ).toContain("width:36px");

        expect(
            renderToStaticMarkup(<UserAvatar src={null} initials="RM" size={64} />)
        ).toContain("width:64px");
    });

    it("is always circular", () => {
        expect(
            renderToStaticMarkup(<UserAvatar src={PNG} initials="RM" size={64} />)
        ).toContain("rounded-full");
    });
});
