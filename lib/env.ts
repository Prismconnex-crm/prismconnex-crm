import { z } from 'zod';

/**
 * Centralized env config. All values are OPTIONAL so the app
 * never crashes on import when Cognito is not yet configured.
 * Individual services should guard against missing values at runtime.
 */
const envSchema = z.object({
    // AWS Cognito (optional until production)
    COGNITO_USER_POOL_ID: z.string().optional(),
    COGNITO_CLIENT_ID: z.string().optional(),
    COGNITO_REGION: z.string().optional().default('us-east-1'),

    // Database (optional — Prisma reads DATABASE_URL directly)
    DATABASE_URL: z.string().optional(),

    // AWS S3 / General
    AWS_REGION: z.string().optional().default('us-east-1'),
    AWS_S3_BUCKET: z.string().optional(),

    // Claude API — powers natural-language search in the Companies tab.
    // Absent = /api/companies/ask returns 503 and the UI falls back to
    // plain company prefix search.
    ANTHROPIC_API_KEY: z.string().optional(),
});

export const env = envSchema.parse({
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
    COGNITO_REGION: process.env.COGNITO_REGION,
    DATABASE_URL: process.env.DATABASE_URL,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});
