import { NextResponse } from 'next/server';
import { ApiError } from './errors';
import { classifyDbConnectionError, redactConnectionUrl } from '@/lib/db/connection-errors';

export function jsonOk<T>(data: T, status = 200, headers?: HeadersInit) {
    return NextResponse.json(data, { status, headers });
}

export function jsonError(error: unknown) {
    console.error('[API Error]:', error);

    if (error instanceof ApiError) {
        return NextResponse.json(
            {
                error: {
                    message: error.message,
                    code: error.name,
                    details: error.details,
                },
            },
            { status: error.statusCode }
        );
    }

    // The database could not be reached at all (wrong/unreachable DATABASE_URL,
    // paused Supabase project, exhausted pool, network down). Matched by name
    // rather than instanceof so this module never pulls @prisma/client into its
    // importers.
    //
    // Note this is NOT an authentication failure: by the time a request reaches
    // here the Supabase password grant has already succeeded or already thrown
    // its own UnauthorizedError. Reporting it as a sign-in problem sends the
    // user to reset a password that was never wrong.
    const dbFailure = classifyDbConnectionError(error);

    if (dbFailure) {
        // The single line that makes the fault identifiable. Prisma's code is
        // the diagnosis (P1000 = bad password, P1001 = host unreachable or
        // project paused, P2024 = pool exhausted) and was previously discarded,
        // which is what left this failure undebuggable from the log alone.
        //
        // The connection string is printed host-only — never with credentials.
        console.error("[DB Unavailable]", {
            prismaCode: dbFailure.code,
            retryable: dbFailure.retryable,
            database: redactConnectionUrl(process.env.DATABASE_URL),
            hint: dbFailure.hint,
        });

        return NextResponse.json(
            {
                error: {
                    message: "The database is unavailable. Please try again shortly.",
                    code: "DatabaseUnavailable",
                    // Outside production only: the code and hint turn a dead-end
                    // banner into something actionable while developing. Kept out
                    // of production responses so the endpoint never advertises
                    // infrastructure detail.
                    ...(process.env.NODE_ENV !== "production"
                        ? { details: { prismaCode: dbFailure.code, hint: dbFailure.hint } }
                        : {}),
                },
            },
            { status: 503 }
        );
    }

    // Fallback to internal server error
    return NextResponse.json(
        {
            error: {
                message: 'Internal Server Error',
                code: 'InternalServerError',
            },
        },
        { status: 500 }
    );
}
