import { z } from "zod";
import { BadRequestError } from "./errors";

export function validateBody<T>(schema: z.ZodType<T>, body: any): T {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new BadRequestError("Validation failed", result.error.format());
    }
    return result.data;
}

export function validateQuery<T>(schema: z.ZodType<T>, query: any): T {
    const result = schema.safeParse(query);
    if (!result.success) {
        throw new BadRequestError("Query validation failed", result.error.format());
    }
    return result.data;
}
