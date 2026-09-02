"use client";

import { useEffect, useState } from "react";
import { UserX } from "lucide-react";

import { readJsonResponse } from "@/lib/http/read-json";
import { NotificationsCard } from "../profile/notifications-card";
import { CardSkeleton, EmptyState, CARD_CLASSES } from "../profile/profile-ui";
import type { ProfileView } from "../profile/types";

/**
 * Settings › Notifications.
 *
 * The card itself is the one from the Profile page — moved, not copied, so
 * there is a single Notification Settings implementation and a single
 * PATCH /api/profile/notifications caller. All this wrapper adds is the
 * profile read the Profile page used to perform on the card's behalf.
 *
 * The preferences are columns on the profile row, so a session with no profile
 * (the seeded demo user, /api/auth/mock-sign-in) has nothing to toggle; that is
 * a real state and is said plainly rather than rendered as switches whose save
 * would 404.
 */
export function NotificationSettingsPanel() {
    const [profile, setProfile] = useState<ProfileView | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const res = await fetch("/api/profile");
                const data = await readJsonResponse<{ profile?: ProfileView | null }>(res);

                if (cancelled) return;

                if (!res.ok || !data) {
                    setLoadError(
                        "We could not load your notification settings. Please refresh the page."
                    );
                    return;
                }

                setProfile(data.profile ?? null);
            } catch {
                if (!cancelled) {
                    setLoadError(
                        "We could not load your notification settings. Please refresh the page."
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) return <CardSkeleton rows={4} />;

    if (loadError || !profile) {
        return (
            <div className={`${CARD_CLASSES} p-4 sm:p-5`}>
                <EmptyState
                    icon={UserX}
                    title={loadError ? "Notification settings unavailable" : "No profile for this session"}
                    description={
                        loadError ||
                        "Notification preferences are stored on your profile, and this session has none. Sign in with your email and password to manage them."
                    }
                />
            </div>
        );
    }

    return <NotificationsCard profile={profile} onProfileChange={setProfile} />;
}
