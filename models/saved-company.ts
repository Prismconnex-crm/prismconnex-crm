import { z } from "zod";

// Snapshot of a company card from the shared SQLite discovery dataset.
// Only id + name are required; the rest is whatever the list/detail view had.
export const SaveCompanySchema = z.object({
    companyId: z.string().min(1),
    snapshot: z
        .object({
            id: z.string().min(1),
            name: z.string().min(1),
        })
        .passthrough(),
});

export type SaveCompanyDTO = z.infer<typeof SaveCompanySchema>;
