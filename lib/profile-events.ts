/**
 * Cross-component notification that the signed-in user's avatar changed.
 *
 * Why an event and not a refetch: the topbar's identity is resolved server-side
 * in app/(app)/app/layout.tsx so it renders correctly on first paint. That
 * layout does NOT re-run when the Profile page uploads a new photo — layouts
 * persist across client navigations — so without a signal the topbar would keep
 * showing the old image until a full page reload.
 *
 * This mirrors the `pcx:company-search` CustomEvent the topbar already uses to
 * talk to the Companies section, rather than introducing a store for one field.
 * A later navigation or reload re-reads the row server-side, so this only has to
 * carry the change for the current page view.
 */

export const AVATAR_CHANGED_EVENT = "pcx:avatar-changed";

/** null = the photo was removed, and listeners should fall back to initials. */
export type AvatarChangedDetail = string | null;

export function emitAvatarChanged(avatarUrl: AvatarChangedDetail) {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
        new CustomEvent<AvatarChangedDetail>(AVATAR_CHANGED_EVENT, { detail: avatarUrl })
    );
}
