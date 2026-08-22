"use client";

import { useEffect, useState } from "react";
import { Briefcase, Pencil, X } from "lucide-react";
import { UpdateProfessionalInfoSchema } from "@/models/profile";
import { readJsonResponse, type ApiErrorBody } from "@/lib/http/read-json";
import {
    Field,
    NotSet,
    PrimaryButton,
    ReadOnlyField,
    SecondaryButton,
    SectionCard,
    StatusMessage,
    TextAreaField,
    formatDate,
    useAutoClearedStatus,
} from "./profile-ui";
import { toDateInputValue, type ProfileView } from "./types";

type FormState = {
    employeeId: string;
    company: string;
    department: string;
    designation: string;
    reportingManager: string;
    team: string;
    joiningDate: string;
    website: string;
    linkedinUrl: string;
    bio: string;
};

function toFormState(profile: ProfileView): FormState {
    return {
        employeeId: profile.employeeId ?? "",
        company: profile.company ?? "",
        department: profile.department ?? "",
        designation: profile.designation ?? "",
        reportingManager: profile.reportingManager ?? "",
        team: profile.team ?? "",
        joiningDate: toDateInputValue(profile.joiningDate),
        website: profile.website ?? "",
        linkedinUrl: profile.linkedinUrl ?? "",
        bio: profile.bio ?? "",
    };
}

/**
 * A stored link, rendered as an anchor with its scheme stripped for display.
 *
 * The href keeps the absolute URL the schema normalised; only the visible text
 * loses the "https://", because that prefix is noise in a profile card and its
 * absence in the href is what would actually break the link.
 *
 * `rel="noopener noreferrer"` is not optional on a user-supplied target="_blank"
 * link: without noopener the destination gets a handle on this window and can
 * navigate it somewhere else.
 */
function LinkValue({ url }: { url: string }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline-offset-2 hover:underline dark:text-brand-hover"
        >
            {url.replace(/^https?:\/\//, "")}
        </a>
    );
}

/** Professional Information, including the skills chip editor. */
export function ProfessionalInfoCard({
    profile,
    onProfileChange,
}: {
    profile: ProfileView;
    onProfileChange: (profile: ProfileView) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<FormState>(() => toFormState(profile));
    const [skills, setSkills] = useState<string[]>(profile.skills);
    const [skillDraft, setSkillDraft] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useAutoClearedStatus();

    useEffect(() => {
        if (editing) return;
        setForm(toFormState(profile));
        setSkills(profile.skills);
    }, [profile, editing]);

    const set = (key: keyof FormState) => (value: string) =>
        setForm((previous) => ({ ...previous, [key]: value }));

    /**
     * Commits the draft as a chip.
     *
     * Deduplicated case-insensitively here as well as in the schema, so the UI
     * does not briefly show a duplicate that the server would then silently
     * drop — a mismatch the user would read as the save having failed.
     */
    const commitSkill = () => {
        const value = skillDraft.trim();
        if (!value) return;
        if (skills.some((skill) => skill.toLowerCase() === value.toLowerCase())) {
            setSkillDraft("");
            return;
        }
        setSkills((previous) => [...previous, value].slice(0, 30));
        setSkillDraft("");
    };

    const cancel = () => {
        setForm(toFormState(profile));
        setSkills(profile.skills);
        setSkillDraft("");
        setFieldErrors({});
        setEditing(false);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setFieldErrors({});

        // An uncommitted draft is almost always intended as a skill — losing it
        // on save is a small, very annoying data loss.
        const pending = skillDraft.trim();
        const allSkills =
            pending && !skills.some((s) => s.toLowerCase() === pending.toLowerCase())
                ? [...skills, pending]
                : skills;

        const payload = { ...form, skills: allSkills };
        const parsed = UpdateProfessionalInfoSchema.safeParse(payload);

        if (!parsed.success) {
            const errors: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path[0];
                if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
            }
            setFieldErrors(errors);
            setStatus({ kind: "error", message: "Please correct the highlighted fields." });
            return;
        }

        setSaving(true);
        setStatus({ kind: null, message: "" });

        try {
            const res = await fetch("/api/profile/professional", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await readJsonResponse<
                ApiErrorBody & { profile?: ProfileView; message?: string }
            >(res);

            if (!res.ok || !data?.profile) {
                throw new Error(data?.error?.message ?? "Could not save your changes.");
            }

            onProfileChange(data.profile);
            setSkillDraft("");
            setEditing(false);
            setStatus({
                kind: "success",
                message: data.message ?? "Professional information updated.",
            });
        } catch (error) {
            setStatus({
                kind: "error",
                message: error instanceof Error ? error.message : "Could not save your changes.",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <SectionCard
            id="professional-information"
            title="Professional Information"
            description="Your role in the organisation."
            icon={Briefcase}
            actions={
                editing ? null : (
                    <SecondaryButton onClick={() => setEditing(true)}>
                        <Pencil className="size-3" aria-hidden="true" />
                        Edit
                    </SecondaryButton>
                )
            }
        >
            {editing ? (
                <form onSubmit={submit} noValidate className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Field
                            label="Employee ID"
                            name="employeeId"
                            value={form.employeeId}
                            onChange={set("employeeId")}
                            error={fieldErrors.employeeId}
                            placeholder="PCX-0142"
                        />
                        <Field
                            label="Company"
                            name="company"
                            value={form.company}
                            onChange={set("company")}
                            error={fieldErrors.company}
                            placeholder="Prismconnex GmbH"
                            autoComplete="organization"
                        />
                        <Field
                            label="Department"
                            name="department"
                            value={form.department}
                            onChange={set("department")}
                            error={fieldErrors.department}
                            placeholder="Sales"
                        />
                        <Field
                            label="Designation"
                            name="designation"
                            value={form.designation}
                            onChange={set("designation")}
                            error={fieldErrors.designation}
                            placeholder="Account Executive"
                            autoComplete="organization-title"
                        />
                        <Field
                            label="Reporting Manager"
                            name="reportingManager"
                            value={form.reportingManager}
                            onChange={set("reportingManager")}
                            error={fieldErrors.reportingManager}
                        />
                        <Field
                            label="Team"
                            name="team"
                            value={form.team}
                            onChange={set("team")}
                            error={fieldErrors.team}
                            placeholder="EMEA Outbound"
                        />
                        <Field
                            label="Joining Date"
                            name="joiningDate"
                            type="date"
                            value={form.joiningDate}
                            onChange={set("joiningDate")}
                            error={fieldErrors.joiningDate}
                        />
                        <Field
                            label="Website"
                            name="website"
                            value={form.website}
                            onChange={set("website")}
                            error={fieldErrors.website}
                            placeholder="example.com"
                            hint="https:// is added if you leave it out"
                            autoComplete="url"
                        />
                        <Field
                            label="LinkedIn"
                            name="linkedinUrl"
                            value={form.linkedinUrl}
                            onChange={set("linkedinUrl")}
                            error={fieldErrors.linkedinUrl}
                            placeholder="linkedin.com/in/your-handle"
                        />
                    </div>

                    <TextAreaField
                        label="About"
                        name="bio"
                        value={form.bio}
                        onChange={set("bio")}
                        error={fieldErrors.bio}
                        placeholder="A short introduction shown on your profile."
                        maxLength={1000}
                        hint={`${form.bio.length}/1000`}
                    />

                    {/* ── Skills ── */}
                    <div>
                        <label
                            htmlFor="skill-input"
                            className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300"
                        >
                            Skills
                        </label>

                        {skills.length ? (
                            <ul className="mb-2 flex flex-wrap gap-1.5">
                                {skills.map((skill) => (
                                    <li key={skill}>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 py-1 pl-2.5 pr-1 text-[11px] font-medium text-brand dark:bg-brand-hover/10 dark:text-brand-hover">
                                            {skill}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSkills((previous) =>
                                                        previous.filter((s) => s !== skill)
                                                    )
                                                }
                                                aria-label={`Remove ${skill}`}
                                                className="rounded-full p-0.5 transition-colors hover:bg-brand/20 dark:hover:bg-brand-hover/20"
                                            >
                                                <X className="size-3" aria-hidden="true" />
                                            </button>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : null}

                        <div className="flex gap-2">
                            <input
                                id="skill-input"
                                value={skillDraft}
                                onChange={(event) => setSkillDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    // Enter must not submit the form — it adds a
                                    // chip. Comma is accepted too, because that
                                    // is how people naturally type a list.
                                    if (event.key === "Enter" || event.key === ",") {
                                        event.preventDefault();
                                        commitSkill();
                                    }
                                    if (
                                        event.key === "Backspace" &&
                                        !skillDraft &&
                                        skills.length
                                    ) {
                                        setSkills((previous) => previous.slice(0, -1));
                                    }
                                }}
                                onBlur={commitSkill}
                                maxLength={40}
                                placeholder="Type a skill and press Enter"
                                aria-describedby="skill-help"
                                className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-[#22304A] dark:bg-[#0F1729] dark:text-white"
                            />
                            <SecondaryButton onClick={commitSkill} className="h-9">
                                Add
                            </SecondaryButton>
                        </div>
                        <p
                            id="skill-help"
                            className="mt-1 text-[11px] text-slate-500 dark:text-slate-400"
                        >
                            {skills.length}/30 · Enter or comma to add, Backspace to remove the last
                        </p>
                        {fieldErrors.skills ? (
                            <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                                {fieldErrors.skills}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <PrimaryButton type="submit" loading={saving}>
                            Save Changes
                        </PrimaryButton>
                        <SecondaryButton onClick={cancel} disabled={saving}>
                            Cancel
                        </SecondaryButton>
                        <div className="ml-auto">
                            <StatusMessage status={status} />
                        </div>
                    </div>
                </form>
            ) : (
                <>
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                        <ReadOnlyField
                            label="Employee ID"
                            value={profile.employeeId ?? <NotSet />}
                            mono={Boolean(profile.employeeId)}
                        />
                        <ReadOnlyField label="Company" value={profile.company ?? <NotSet />} />
                        <ReadOnlyField
                            label="Department"
                            value={profile.department ?? <NotSet />}
                        />
                        <ReadOnlyField
                            label="Designation"
                            value={profile.designation ?? <NotSet />}
                        />
                        <ReadOnlyField
                            label="Reporting Manager"
                            value={profile.reportingManager ?? <NotSet />}
                        />
                        <ReadOnlyField label="Team" value={profile.team ?? <NotSet />} />
                        <ReadOnlyField
                            label="Joining Date"
                            value={
                                profile.joiningDate ? formatDate(profile.joiningDate) : <NotSet />
                            }
                        />
                        <ReadOnlyField
                            label="Website"
                            value={
                                profile.website ? <LinkValue url={profile.website} /> : <NotSet />
                            }
                        />
                        <ReadOnlyField
                            label="LinkedIn"
                            value={
                                profile.linkedinUrl ? (
                                    <LinkValue url={profile.linkedinUrl} />
                                ) : (
                                    <NotSet />
                                )
                            }
                        />
                    </dl>

                    {profile.bio ? (
                        <div className="mt-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                About
                            </p>
                            {/*
                                whitespace-pre-line, not a dangerouslySetInnerHTML
                                render: the bio is user input, so the newlines the
                                user typed are honoured by CSS while the content
                                itself stays plain text and cannot inject markup.
                            */}
                            <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-slate-900 dark:text-slate-100">
                                {profile.bio}
                            </p>
                        </div>
                    ) : null}

                    <div className="mt-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Skills
                        </p>
                        {profile.skills.length ? (
                            <ul className="mt-1.5 flex flex-wrap gap-1.5">
                                {profile.skills.map((skill) => (
                                    <li
                                        key={skill}
                                        className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand dark:bg-brand-hover/10 dark:text-brand-hover"
                                    >
                                        {skill}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-1 text-[13px] text-slate-400 dark:text-slate-500">
                                No skills added yet
                            </p>
                        )}
                    </div>

                    <div className="mt-3">
                        <StatusMessage status={status} />
                    </div>
                </>
            )}
        </SectionCard>
    );
}
