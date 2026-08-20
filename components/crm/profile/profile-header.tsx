"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { BadgeCheck, Camera, Eye, Loader2, Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarViewer } from "@/components/app-shell/avatar-viewer";
import { AvatarSourceDialog } from "./avatar-source-dialog";
import { readJsonResponse, type ApiErrorBody } from "@/lib/http/read-json";
import { emitAvatarChanged } from "@/lib/profile-events";
import {
    CARD_CLASSES,
    PrimaryButton,
    SecondaryButton,
    StatusMessage,
    useAutoClearedStatus,
} from "./profile-ui";
import { fullNameOf, initialsOf, type AccountView, type ProfileView } from "./types";

/**
 * Mirrors lib/supabase/storage.ts, which mirrors the bucket. Three copies is
 * deliberate: this one is for the message, the server's is the real check, and
 * the bucket's is the one that cannot be bypassed. Change all three together.
 */
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const MAX_AVATAR_MB = 5;

/**
 * Profile header: photo, identity, status, and the entry point to editing.
 *
 * The photo is the only part that writes on its own — everything else here is
 * a summary of fields owned by the cards below, so "Edit Profile" scrolls to
 * the Personal Information card and puts it into edit mode rather than opening
 * a second, competing editor for the same data.
 */
export function ProfileHeader({
    profile,
    account,
    onProfileChange,
    onEditRequested,
}: {
    profile: ProfileView;
    account: AccountView;
    onProfileChange: (profile: ProfileView) => void;
    onEditRequested: () => void;
}) {
    const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [sourceOpen, setSourceOpen] = useState(false);
    // The two inputs live here, outside the dialog, so they survive it closing —
    // the OS file/camera picker is async and would never fire `change` on an
    // input that unmounted with the modal.
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useAutoClearedStatus();

    const uploadDisabled = !account.hasSupabaseSession;

    const handleFile = async (file: File) => {
        // Checked here purely to fail fast — the server and the bucket both
        // enforce the same two limits, and this cannot be trusted. It only
        // saves the user waiting for a 6 MB upload that was always going to be
        // rejected.
        if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
            setStatus({
                kind: "error",
                message: "Unsupported image format. Use PNG, JPEG, WebP or GIF.",
            });
            return;
        }

        if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
            setStatus({
                kind: "error",
                message: `Image is larger than ${MAX_AVATAR_MB} MB. Choose a smaller file.`,
            });
            return;
        }

        setBusy("upload");
        setStatus({ kind: null, message: "" });

        try {
            // multipart, not a base64 JSON body — see the avatar route.
            const body = new FormData();
            body.append("file", file);

            const res = await fetch("/api/profile/avatar", { method: "POST", body });
            const data = await readJsonResponse<
                ApiErrorBody & { profile?: ProfileView; message?: string }
            >(res);

            if (!res.ok || !data?.profile) {
                throw new Error(data?.error?.message ?? "Could not upload the photo.");
            }

            onProfileChange(data.profile);
            // Updates the topbar avatar and its dropdown in place.
            emitAvatarChanged(data.profile.avatarUrl);
            setStatus({ kind: "success", message: data.message ?? "Profile photo updated." });
        } catch (error) {
            setStatus({
                kind: "error",
                message: error instanceof Error ? error.message : "Could not upload the photo.",
            });
        } finally {
            setBusy(null);
        }
    };

    const handleRemove = async () => {
        setBusy("remove");
        setStatus({ kind: null, message: "" });

        try {
            const res = await fetch("/api/profile/avatar", { method: "DELETE" });
            const data = await readJsonResponse<
                ApiErrorBody & { profile?: ProfileView; message?: string }
            >(res);

            if (!res.ok || !data?.profile) {
                throw new Error(data?.error?.message ?? "Could not remove the photo.");
            }

            onProfileChange(data.profile);
            // null -> the topbar falls back to initials, same as on load.
            emitAvatarChanged(data.profile.avatarUrl);
            setStatus({ kind: "success", message: data.message ?? "Profile photo removed." });
        } catch (error) {
            setStatus({
                kind: "error",
                message: error instanceof Error ? error.message : "Could not remove the photo.",
            });
        } finally {
            setBusy(null);
        }
    };

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Clear the input immediately — the File is already captured, and this
        // is what lets the SAME file be chosen again after a rejection, which
        // is the first thing a user retries.
        event.target.value = "";
        if (file) void handleFile(file);
    };

    /**
     * Closes the chooser and opens the matching input. The .click() is still
     * inside the user's own click, so it counts as a user gesture — browsers
     * would block it otherwise.
     */
    const handleSourceSelect = (source: "camera" | "gallery") => {
        setSourceOpen(false);
        const input = source === "camera" ? cameraInputRef.current : galleryInputRef.current;
        input?.click();
    };

    const isActive = profile.accountStatus === "active";

    return (
        <div className={cn(CARD_CLASSES, "p-4 sm:p-5")}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* ── Avatar ── */}
                <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                        {/*
                            The photo itself opens the viewer, matching the
                            topbar avatar. A button, not an onClick on the div,
                            so it is reachable by keyboard and announced.
                        */}
                        <button
                            type="button"
                            onClick={() => setViewerOpen(true)}
                            title="View profile image"
                            aria-label="View profile image"
                            className="block rounded-full transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                        >
                        <div className="size-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.04] sm:size-24">
                            {profile.avatarUrl ? (
                                // unoptimized: the Supabase Storage host is not
                                // in next.config images.remotePatterns, and
                                // adding it would be a config change for one
                                // small, already-CDN-served image.
                                <Image
                                    src={profile.avatarUrl}
                                    alt=""
                                    width={96}
                                    height={96}
                                    unoptimized
                                    className="size-full object-cover"
                                />
                            ) : (
                                <div
                                    aria-hidden="true"
                                    className="flex size-full items-center justify-center text-[22px] font-bold text-brand dark:text-brand-hover"
                                >
                                    {initialsOf(profile)}
                                </div>
                            )}
                        </div>
                        </button>

                        {busy === "upload" ? (
                            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                                <Loader2 className="size-5 animate-spin text-white" />
                            </div>
                        ) : null}
                    </div>

                    <div className="flex w-full max-w-[190px] flex-col items-stretch gap-1.5">
                        <button
                            type="button"
                            onClick={() => setViewerOpen(true)}
                            className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                        >
                            <Eye className="size-3" aria-hidden="true" />
                            View Profile Image
                        </button>

                        {/*
                            Two inputs, one per source. `capture` is what makes
                            the Camera option skip the OS chooser entirely and
                            go straight to the camera on a phone; on desktop the
                            attribute is ignored and it falls back to the normal
                            file picker, which is the correct behaviour there.
                            Both land in the same handleFile — one upload path.
                        */}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                            capture="environment"
                            className="hidden"
                            id="avatar-upload-camera"
                            aria-hidden="true"
                            tabIndex={-1}
                            disabled={uploadDisabled || busy !== null}
                            onChange={handleInputChange}
                        />
                        <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                            className="hidden"
                            id="avatar-upload"
                            aria-hidden="true"
                            tabIndex={-1}
                            disabled={uploadDisabled || busy !== null}
                            onChange={handleInputChange}
                        />
                        {/*
                            A button, not the <label for> this used to be: the
                            click now opens our centred chooser first, and the
                            input it ends up triggering depends on the answer.
                        */}
                        <button
                            type="button"
                            onClick={() => setSourceOpen(true)}
                            disabled={uploadDisabled || busy !== null}
                            className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                        >
                            <Camera className="size-3" aria-hidden="true" />
                            {profile.avatarUrl ? "Change Profile Image" : "Upload Profile Image"}
                        </button>

                        {profile.avatarUrl ? (
                            <button
                                type="button"
                                onClick={handleRemove}
                                disabled={uploadDisabled || busy !== null}
                                className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-[#22304A] dark:text-red-400 dark:hover:bg-red-500/10"
                            >
                                <Trash2 className="size-3" aria-hidden="true" />
                                Remove
                            </button>
                        ) : null}
                    </div>

                    <p className="text-center text-[10px] text-slate-500 dark:text-slate-400">
                        PNG, JPEG, WebP or GIF · max 5 MB
                    </p>
                </div>

                {/* ── Identity ── */}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="truncate text-[18px] font-bold tracking-tight text-slate-900 dark:text-white">
                            {fullNameOf(profile)}
                        </h1>

                        {/*
                            Online status is presence, which this app does not
                            track — there is no heartbeat, socket or
                            last-seen-ping anywhere in the codebase. So this
                            reports the account state it can actually prove,
                            rather than a green "Online" dot that would be
                            decoration pretending to be data.
                        */}
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                isActive
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "size-1.5 rounded-full",
                                    isActive ? "bg-emerald-500" : "bg-amber-500"
                                )}
                            />
                            {isActive ? "Active" : profile.accountStatus}
                        </span>

                        {account.emailVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand dark:bg-brand-hover/10 dark:text-brand-hover">
                                <BadgeCheck className="size-3" aria-hidden="true" />
                                Verified
                            </span>
                        ) : null}
                    </div>

                    {profile.designation || profile.department ? (
                        <p className="mt-0.5 text-[13px] font-medium text-slate-700 dark:text-slate-300">
                            {[profile.designation, profile.department].filter(Boolean).join(" · ")}
                        </p>
                    ) : (
                        <p className="mt-0.5 text-[13px] text-slate-400 dark:text-slate-500">
                            No job title set
                        </p>
                    )}

                    <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                        <div className="flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-400">
                            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                            <dt className="sr-only">Email address</dt>
                            <dd className="truncate">{profile.email}</dd>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-400">
                            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                            <dt className="sr-only">Phone number</dt>
                            <dd>{profile.phone ?? "No phone number"}</dd>
                        </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <PrimaryButton onClick={onEditRequested}>
                            <Pencil className="size-3.5" aria-hidden="true" />
                            Edit Profile
                        </PrimaryButton>
                        {account.role ? (
                            <SecondaryButton disabled>{account.role}</SecondaryButton>
                        ) : null}
                    </div>

                    {uploadDisabled ? (
                        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                            Photo upload needs a Supabase session — sign in with your email and
                            password to enable it.
                        </p>
                    ) : null}

                    <div className="mt-2">
                        <StatusMessage status={status} />
                    </div>
                </div>
            </div>

            {/* Centred source chooser — replaces the browser's bottom sheet. */}
            <AvatarSourceDialog
                open={sourceOpen}
                onOpenChange={setSourceOpen}
                onSelect={handleSourceSelect}
            />

            {/* Same viewer the topbar uses — one component, one behaviour. */}
            <AvatarViewer
                open={viewerOpen}
                onOpenChange={setViewerOpen}
                src={profile.avatarUrl}
                initials={initialsOf(profile)}
                name={fullNameOf(profile)}
            />
        </div>
    );
}
