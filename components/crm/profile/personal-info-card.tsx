"use client";

import { forwardRef, useEffect, useState } from "react";
import { Pencil, User } from "lucide-react";
import { UpdatePersonalInfoSchema } from "@/models/profile";
import { readJsonResponse, type ApiErrorBody } from "@/lib/http/read-json";
import {
    Field,
    NotSet,
    PrimaryButton,
    ReadOnlyField,
    SecondaryButton,
    SectionCard,
    StatusMessage,
    formatDate,
    useAutoClearedStatus,
} from "./profile-ui";
import { toDateInputValue, type ProfileView } from "./types";

/**
 * Personal Information — the one card with a full read/edit cycle.
 *
 * Read mode shows a definition list; edit mode swaps in the form. The pattern
 * is deliberate for a CRM profile: the page is read far more often than it is
 * written, and a screen of always-editable inputs invites accidental changes
 * and makes "what is my address on file?" harder to answer at a glance.
 *
 * Validation runs client-side against the SAME Zod schema the API uses
 * (models/profile.ts), so the two cannot drift into disagreeing about what is
 * acceptable. The server still validates independently — this is for fast
 * feedback, not a substitute.
 */

type FormState = {
    firstName: string;
    middleName: string;
    lastName: string;
    email: string;
    phone: string;
    alternatePhone: string;
    dateOfBirth: string;
    addressLine: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
};

function toFormState(profile: ProfileView): FormState {
    return {
        firstName: profile.firstName,
        middleName: profile.middleName ?? "",
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone ?? "",
        alternatePhone: profile.alternatePhone ?? "",
        dateOfBirth: toDateInputValue(profile.dateOfBirth),
        addressLine: profile.addressLine ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
        country: profile.country ?? "",
        postalCode: profile.postalCode ?? "",
    };
}

export const PersonalInfoCard = forwardRef<
    HTMLDivElement,
    {
        profile: ProfileView;
        editing: boolean;
        onEditingChange: (editing: boolean) => void;
        onProfileChange: (profile: ProfileView) => void;
    }
>(function PersonalInfoCard({ profile, editing, onEditingChange, onProfileChange }, ref) {
    const [form, setForm] = useState<FormState>(() => toFormState(profile));
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useAutoClearedStatus();

    // Re-seed whenever the saved profile changes (another card saved, or this
    // one just did), so a cancelled edit can never resurrect stale values.
    useEffect(() => {
        if (!editing) setForm(toFormState(profile));
    }, [profile, editing]);

    const set = (key: keyof FormState) => (value: string) =>
        setForm((previous) => ({ ...previous, [key]: value }));

    const cancel = () => {
        setForm(toFormState(profile));
        setFieldErrors({});
        setStatus({ kind: null, message: "" });
        onEditingChange(false);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setFieldErrors({});

        const parsed = UpdatePersonalInfoSchema.safeParse(form);
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
            const res = await fetch("/api/profile/personal", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await readJsonResponse<
                ApiErrorBody & { profile?: ProfileView; message?: string }
            >(res);

            if (!res.ok || !data?.profile) {
                throw new Error(data?.error?.message ?? "Could not save your changes.");
            }

            onProfileChange(data.profile);
            onEditingChange(false);
            setStatus({ kind: "success", message: data.message ?? "Personal information updated." });
        } catch (error) {
            setStatus({
                kind: "error",
                message:
                    error instanceof Error ? error.message : "Could not save your changes.",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div ref={ref}>
            <SectionCard
                id="personal-information"
                title="Personal Information"
                description="Your name, contact details and address."
                icon={User}
                actions={
                    editing ? null : (
                        <SecondaryButton onClick={() => onEditingChange(true)}>
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
                                label="First Name"
                                name="firstName"
                                required
                                value={form.firstName}
                                onChange={set("firstName")}
                                error={fieldErrors.firstName}
                                autoComplete="given-name"
                            />
                            <Field
                                label="Middle Name"
                                name="middleName"
                                value={form.middleName}
                                onChange={set("middleName")}
                                error={fieldErrors.middleName}
                                autoComplete="additional-name"
                            />
                            <Field
                                label="Last Name"
                                name="lastName"
                                required
                                value={form.lastName}
                                onChange={set("lastName")}
                                error={fieldErrors.lastName}
                                autoComplete="family-name"
                            />
                            <Field
                                label="Email Address"
                                name="email"
                                type="email"
                                required
                                value={form.email}
                                onChange={set("email")}
                                error={fieldErrors.email}
                                autoComplete="email"
                                inputMode="email"
                                hint="Changing this sends a confirmation link to the new address."
                            />
                            <Field
                                label="Mobile Number"
                                name="phone"
                                type="tel"
                                value={form.phone}
                                onChange={set("phone")}
                                error={fieldErrors.phone}
                                autoComplete="tel"
                                inputMode="tel"
                                placeholder="9876543210"
                            />
                            <Field
                                label="Alternate Mobile Number"
                                name="alternatePhone"
                                type="tel"
                                value={form.alternatePhone}
                                onChange={set("alternatePhone")}
                                error={fieldErrors.alternatePhone}
                                inputMode="tel"
                                placeholder="Optional"
                            />
                            <Field
                                label="Date of Birth"
                                name="dateOfBirth"
                                type="date"
                                value={form.dateOfBirth}
                                onChange={set("dateOfBirth")}
                                error={fieldErrors.dateOfBirth}
                                autoComplete="bday"
                            />
                            <Field
                                label="City"
                                name="city"
                                value={form.city}
                                onChange={set("city")}
                                error={fieldErrors.city}
                                autoComplete="address-level2"
                            />
                            <Field
                                label="State"
                                name="state"
                                value={form.state}
                                onChange={set("state")}
                                error={fieldErrors.state}
                                autoComplete="address-level1"
                            />
                            <Field
                                label="Country"
                                name="country"
                                value={form.country}
                                onChange={set("country")}
                                error={fieldErrors.country}
                                autoComplete="country-name"
                            />
                            <Field
                                label="PIN / ZIP Code"
                                name="postalCode"
                                value={form.postalCode}
                                onChange={set("postalCode")}
                                error={fieldErrors.postalCode}
                                autoComplete="postal-code"
                                inputMode="numeric"
                            />
                        </div>

                        <Field
                            label="Address"
                            name="addressLine"
                            value={form.addressLine}
                            onChange={set("addressLine")}
                            error={fieldErrors.addressLine}
                            autoComplete="street-address"
                            placeholder="Street, building, area"
                        />

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
                                label="Full Name"
                                value={
                                    [profile.firstName, profile.middleName, profile.lastName]
                                        .filter(Boolean)
                                        .join(" ") || <NotSet />
                                }
                            />
                            <ReadOnlyField label="Email Address" value={profile.email} />
                            <ReadOnlyField
                                label="Mobile Number"
                                value={profile.phone ?? <NotSet />}
                            />
                            <ReadOnlyField
                                label="Alternate Mobile"
                                value={profile.alternatePhone ?? <NotSet />}
                            />
                            <ReadOnlyField
                                label="Date of Birth"
                                value={
                                    profile.dateOfBirth ? (
                                        formatDate(profile.dateOfBirth)
                                    ) : (
                                        <NotSet />
                                    )
                                }
                            />
                            <ReadOnlyField
                                label="Address"
                                value={profile.addressLine ?? <NotSet />}
                            />
                            <ReadOnlyField label="City" value={profile.city ?? <NotSet />} />
                            <ReadOnlyField label="State" value={profile.state ?? <NotSet />} />
                            <ReadOnlyField
                                label="Country"
                                value={profile.country ?? <NotSet />}
                            />
                            <ReadOnlyField
                                label="PIN / ZIP Code"
                                value={profile.postalCode ?? <NotSet />}
                            />
                        </dl>
                        <div className="mt-3">
                            <StatusMessage status={status} />
                        </div>
                    </>
                )}
            </SectionCard>
        </div>
    );
});
