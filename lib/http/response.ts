import { NextResponse } from 'next/server';
import { ApiError } from './errors';

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
