"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserX } from "lucide-react";
import { readJsonResponse } from "@/lib/http/read-json";
import { ProfileHeader } from "./profile/profile-header";
import { PersonalInfoCard } from "./profile/personal-info-card";
import { ProfessionalInfoCard } from "./profile/professional-info-card";
import { AccountInfoCard } from "./profile/account-info-card";
import { SecurityCard } from "./profile/security-card";
import { ActivityCard } from "./profile/activity-card";
import { UpgradePlanCard } from "./profile/upgrade-plan-card";
import { ReferUserCard } from "./profile/refer-user-card";
import { ManageUsersCard } from "./profile/manage-users-card";
import { CreditUsageCard } from "./profile/credit-usage-card";
import { CardSkeleton, EmptyState, Skeleton, CARD_CLASSES } from "./profile/profile-ui";
import type { AccountView, ActivityView, ProfileView } from "./profile/types";
import type { CreditUsageDTO } from "@/models/billing";

/**
 * The Profile page: /app/profile.
 *
 * ── Where the state lives ──
 * One copy of the profile, here. Every card receives it and reports edits back
 * through `onProfileChange`, which replaces it with whatever the server
 * returned from that save. The alternative — each card holding and refetching
 * its own copy — is how the header ends up showing a name the Personal card
 * has already changed.
 *
 * Activity is fetched separately and in parallel: it is the slowest query on
 * the page (five counts plus an audit read) and nothing else waits for it, so
 * blocking the whole page on it would delay the part the user came to see.
 */
export function ProfileSection() {
    const [profile, setProfile] = useState<ProfileView | null>(null);
    const [account, setAccount] = useState<AccountView | null>(null);
    const [activity, setActivity] = useState<ActivityView | null>(null);
    const [credits, setCredits] = useState<CreditUsageDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [activityLoading, setActivityLoading] = useState(true);
    const [creditsLoading, setCreditsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const [editingPersonal, setEditingPersonal] = useState(false);
    const personalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const res = await fetch("/api/profile");
                const data = await readJsonResponse<{
                    profile?: ProfileView | null;
                    account?: AccountView;
                }>(res);

                if (cancelled) return;

                if (!res.ok || !data) {
                    setLoadError("We could not load your profile. Please refresh the page.");
                    return;
                }

                setProfile(data.profile ?? null);
                setAccount(data.account ?? null);
            } catch {
                if (!cancelled) {
                    setLoadError("We could not load your profile. Please refresh the page.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        void (async () => {
            try {
                const res = await fetch("/api/profile/activity");
                const data = await readJsonResponse<{ activity?: ActivityView }>(res);
                if (!cancelled && res.ok && data?.activity) setActivity(data.activity);
            } catch {
                // Non-fatal: the Activity card renders its own empty state.
            } finally {
                if (!cancelled) setActivityLoading(false);
            }
        })();

        // Credits are workspace-scoped and independent of the profile read, so
        // they load in parallel for the same reason activity does: neither
        // should hold up the part of the page the user came for.
        void (async () => {
            try {
                const res = await fetch("/api/profile/credits");
                const data = await readJsonResponse<{ usage?: CreditUsageDTO | null }>(res);
                if (!cancelled && res.ok) setCredits(data?.usage ?? null);
            } catch {
                // Non-fatal: the Credit Usage card renders its own empty state.
            } finally {
                if (!cancelled) setCreditsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    /**
     * "Edit Profile" in the header opens the Personal Information card and
     * scrolls to it, rather than opening a second editor for the same fields.
     * The scroll is deferred one frame so it targets the card at its expanded
     * height, not the collapsed one it had when the click landed.
     */
    const startEditing = useCallback(() => {
        setEditingPersonal(true);
        requestAnimationFrame(() => {
            personalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }, []);

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-[1200px] space-y-3 pb-10">
                <div className={`${CARD_CLASSES} flex gap-4 p-4 sm:p-5`}>
                    <Skeleton className="size-20 rounded-full sm:size-24" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>
                <CardSkeleton rows={3} />
                <CardSkeleton rows={2} />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="mx-auto w-full max-w-[1200px] pb-10">
                <div className={`${CARD_CLASSES} p-5`}>
                    <EmptyState
                        icon={UserX}
                        title="Profile unavailable"
                        description={loadError}
                    />
                </div>
            </div>
        );
    }

    // A signed-in session with no profile row is a real state, not a bug: the
    // seeded demo user and /api/auth/mock-sign-in both produce a session whose
    // `sub` is not a Supabase user id, so no profiles row exists to show.
    if (!profile || !account) {
        return (
            <div className="mx-auto w-full max-w-[1200px] pb-10">
                <div className={`${CARD_CLASSES} p-5`}>
                    <EmptyState
                        icon={UserX}
                        title="No profile for this session"
                        description="This session was not created through Supabase Auth, so there is no profile record to display. Sign in with your email and password to see your profile."
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-3 pb-10">
            <ProfileHeader
                profile={profile}
                account={account}
                onProfileChange={setProfile}
                onEditRequested={startEditing}
            />

            <PersonalInfoCard
                ref={personalRef}
                profile={profile}
                editing={editingPersonal}
                onEditingChange={setEditingPersonal}
                onProfileChange={setProfile}
            />

            <ProfessionalInfoCard profile={profile} onProfileChange={setProfile} />

            <AccountInfoCard profile={profile} account={account} />

            <SecurityCard account={account} />

            {/*
                Plan, referrals, members and credits sit together, after the
                identity cards and before the historical one: they are the
                things the user acts ON, whereas Activity is history.
                Notification Settings is not here — it lives in
                Settings › Notifications, with the workspace preferences.
            */}
            <UpgradePlanCard usage={credits} loading={creditsLoading} />

            <ReferUserCard />

            <ManageUsersCard account={account} />

            <CreditUsageCard usage={credits} loading={creditsLoading} />

            <ActivityCard activity={activity} loading={activityLoading} />
        </div>
    );
}
