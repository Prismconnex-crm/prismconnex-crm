import { z } from "zod";

/**
 * Pipeline order. CONVERTED is reached only through Convert to Deal (see
 * LeadService), so the UI never offers it as a manual choice.
 */
export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "NURTURING", "CONVERTED", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ["MANUAL", "EVENT", "IMPORT", "REFERRAL", "WEBSITE", "DISCOVERY", "OTHER"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/**
 * Optional free text from a form: trimmed, and "" becomes null so an emptied
 * input clears the column instead of storing an empty string.
 */
function optionalText(max: number) {
    return z
        .string()
        .trim()
        .max(max)
        .transform((value) => (value === "" ? null : value))
        .nullable()
        .optional();
}

const optionalEmail = optionalText(254).refine(
    (value) => value == null || z.email().safeParse(value).success,
    "Enter a valid email address"
);

/**
 * "YYYY-MM-DD" or a full ISO timestamp; "" or null clears the date.
 * `.nullable().optional()` stays outermost so the inferred key is optional.
 */
const optionalDate = z
    .string()
    .trim()
    .max(40)
    .transform((value) => (value === "" ? null : new Date(value)))
    .refine((value) => value === null || !Number.isNaN(value.getTime()), "Enter a valid date")
    .nullable()
    .optional();

const leadFields = {
    fullName: z.string().trim().min(1, "Name is required").max(120),
    email: optionalEmail,
    phone: optionalText(40),
    jobTitle: optionalText(120),
    companyName: optionalText(160),
    companyId: z.string().min(1).nullable().optional(),
    source: z.enum(LEAD_SOURCES),
    status: z.enum(LEAD_STATUSES),
    score: z.number().int().min(0).max(100),
    /**
     * Omitted = assign to the creator; null = explicitly unassigned. The two
     * must stay distinguishable, which is why this has no default.
     */
    ownerId: z.string().min(1).nullable().optional(),
    nextFollowUpAt: optionalDate,
};

export const CreateLeadSchema = z.object({
    ...leadFields,
    source: leadFields.source.default("MANUAL"),
    status: leadFields.status.default("NEW"),
    score: leadFields.score.default(0),
});

/**
 * Built from the same fields but without defaults. `CreateLeadSchema.partial()`
 * would re-apply status "NEW" and score 0 to a PATCH that never mentioned
 * them, silently resetting the lead.
 */
export const UpdateLeadSchema = z.object(leadFields).partial();

export const ConvertLeadToDealSchema = z.object({
    dealName: z.string().trim().min(1, "Deal name is required").max(160),
    amount: z.number().min(0).default(0),
});

export const LeadNoteSchema = z.object({
    body: z.string().trim().min(1, "Note cannot be empty").max(2000),
});

/**
 * Query string for GET /api/leads. `owner` is "me", "unassigned" or a CRM
 * User.id; the service resolves "me" so the client never has to know its id.
 */
export const LeadListQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(LEAD_STATUSES).optional(),
    owner: z.string().trim().min(1).max(64).optional(),
    cursor: z.string().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateLeadDTO = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadDTO = z.infer<typeof UpdateLeadSchema>;
export type ConvertLeadToDealDTO = z.infer<typeof ConvertLeadToDealSchema>;
export type LeadNoteInput = z.infer<typeof LeadNoteSchema>;
export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;

// ─── Response shapes (what the API returns, dates as ISO strings) ──────────

export type LeadPersonRef = { id: string; name: string };

export type LeadNoteDTO = {
    id: string;
    body: string;
    createdAt: string;
    author: LeadPersonRef | null;
};

export type LeadDTO = {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    companyName: string | null;
    companyId: string | null;
    source: string;
    status: string;
    score: number;
    owner: LeadPersonRef | null;
    nextFollowUpAt: string | null;
    deal: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
};

export type LeadDetailDTO = LeadDTO & { notes: LeadNoteDTO[] };

export type LeadStatsDTO = {
    total: number;
    byStatus: Record<LeadStatus, number>;
    /** Converted as a whole-number percentage of all leads; 0 when there are none. */
    conversionRate: number;
};

export type LeadListDTO = {
    items: LeadDTO[];
    nextCursor: string | null;
    stats: LeadStatsDTO;
};
