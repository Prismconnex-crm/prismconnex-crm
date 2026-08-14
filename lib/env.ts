import { z } from 'zod';

/**
 * Centralized env config. All values are OPTIONAL so the app
 * never crashes on import when Cognito is not yet configured.
 * Individual services should guard against missing values at runtime.
 */
const envSchema = z.object({
    // Supabase Auth — the active auth provider.
    // The anon key is sufficient: signup, the password grant and the OAuth
    // authorize/PKCE endpoints all accept it, and profile reads go through
    // Prisma as `postgres` (which bypasses RLS). No service_role key needed.
    SUPABASE_URL: z.url().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),

    // Secret used to sign the pcx_session cookie (lib/auth.ts).
    AUTH_SECRET: z.string().optional(),

    // Base URL used to build the OAuth redirect_to target.
    APP_URL: z.url().optional(),

    // AWS Cognito — dormant, superseded by Supabase Auth. Retained so the
    // legacy lib/auth/cognito.ts helpers keep type-checking.
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
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    AUTH_SECRET: process.env.AUTH_SECRET,
    APP_URL: process.env.APP_URL,
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
    COGNITO_REGION: process.env.COGNITO_REGION,
    DATABASE_URL: process.env.DATABASE_URL,
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});
