"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Users } from "lucide-react";

import type { AccountView } from "./types";
import { SectionCard } from "./profile-ui";

/**
 * Manage Users.
 *
 * Routes to the existing /app/team section rather than introducing a second
 * place to administer members. The role shown is the viewer's own, read from
 * the workspace membership that /api/profile already returns.
 *
 * Only ADMIN can actually change members, so the card says so instead of
 * sending a VIEWER to a screen where every control is refused — the role is
 * displayed rather than used to hide the link, because seeing who does have
 * the permission is the useful part.
 */
const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    SALES_REP: "Sales Rep",
    SUPPORT: "Support",
    VIEWER: "Viewer",
};

export function ManageUsersCard({ account }: { account: AccountView }) {
    const role = account.role ?? null;
    const isAdmin = role === "ADMIN";

    return (
        <SectionCard
            id="users"
            title="Manage Users"
            description="Members, roles and permissions for this workspace."
            icon={Users}
            actions={
                <Link
                    href="/app/team"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                >
                    Open Team
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
            }
        >
            <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] dark:border-white/[0.06]">
                    <ShieldCheck
                        className="size-3.5 text-slate-500 dark:text-slate-400"
                        aria-hidden="true"
                    />
                    <span className="text-slate-600 dark:text-slate-400">Your role</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                        {role ? (ROLE_LABELS[role] ?? role) : "Unknown"}
                    </span>
                </span>

                <p className="text-[12px] text-slate-600 dark:text-slate-400">
                    {isAdmin
                        ? "You can invite members and change their roles."
                        : "Only workspace admins can change members and roles."}
                </p>
            </div>
        </SectionCard>
    );
}
