import { z } from "zod";
import { BadRequestError } from "./errors";

/**
 * Builds "workspaceName: Workspace name must be at least 2 characters" from the
 * first issue. A bare "Validation failed" reaches the UI with no indication of
 * which field was rejected, which makes these 400s undebuggable from the client.
 */
function describeIssues(error: z.ZodError, fallback: string): string {
    const issue = error.issues[0];
    if (!issue) {
        return fallback;
    }

    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
}

export function validateBody<T>(schema: z.ZodType<T>, body: any): T {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new BadRequestError(
            describeIssues(result.error, "Validation failed"),
            result.error.format()
        );
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
