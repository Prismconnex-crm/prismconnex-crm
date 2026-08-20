import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AvatarViewer } from "@/components/app-shell/avatar-viewer";

/**
 * Cover for the profile image viewer's content states.
 *
 * Radix renders the dialog into a portal, which needs a DOM, so these assert
 * the two things that are decidable without one: a closed viewer contributes
 * nothing to the page, and the component does not throw for any of the three
 * inputs it has to survive (a photo, no photo, and a name with no photo).
 *
 * The open-state branches — skeleton, error message, download button — are
 * exercised by hand in the browser; jsdom is not installed.
 */

const PNG =
    "https://project-ref.supabase.co/storage/v1/object/public/avatars/user-id/photo.png";

const noop = () => {};

describe("AvatarViewer", () => {
    it("renders nothing while closed, so it cannot affect page layout", () => {
        const html = renderToStaticMarkup(
            <AvatarViewer
                open={false}
                onOpenChange={noop}
                src={PNG}
                initials="RM"
                name="Reddappa gari manjunatha"
            />
        );

        expect(html).toBe("");
    });

    it("renders closed without throwing when there is no photo", () => {
        expect(() =>
            renderToStaticMarkup(
                <AvatarViewer
                    open={false}
                    onOpenChange={noop}
                    src={null}
                    initials="RM"
                    name="Reddappa gari manjunatha"
                />
            )
        ).not.toThrow();
    });
});
