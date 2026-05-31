import { z } from "zod";

export const CreateLeadSchema = z.object({
    companyId: z.string().optional().nullable(),
    source: z.string().min(1),
    status: z.enum(["NEW", "QUALIFIED", "NURTURING", "CONVERTED", "LOST"]).default("NEW"),
    score: z.number().int().min(0).default(0),
});

export const UpdateLeadSchema = CreateLeadSchema.partial();

export const ConvertLeadToDealSchema = z.object({
    dealName: z.string().min(1),
    amount: z.number().min(0).default(0),
});

export type CreateLeadDTO = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadDTO = z.infer<typeof UpdateLeadSchema>;
export type ConvertLeadToDealDTO = z.infer<typeof ConvertLeadToDealSchema>;
