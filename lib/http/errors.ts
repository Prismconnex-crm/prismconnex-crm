export class ApiError extends Error {
    public statusCode: number;
    public details?: unknown;

    constructor(message: string, statusCode: number, details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.details = details;
    }
}

export class BadRequestError extends ApiError {
    constructor(message = 'Bad Request', details?: unknown) {
        super(message, 400, details);
        this.name = 'BadRequestError';
    }
}

export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
        super(message, 403);
        this.name = 'ForbiddenError';
    }
}

export class NotFoundError extends ApiError {
    constructor(message = 'Not Found') {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

/**
 * The signup OTP was issued too long ago to still be accepted.
 *
 * Distinct from BadRequestError because the verify page keys off
 * `error.code === "OtpExpiredError"` to swap the form for the "Resend
 * Verification Code" button. GoTrue cannot make this distinction for us: it
 * answers 403 `otp_expired` for a *wrong* code just as it does for a stale one
 * (verified against the live project), so "expired" has to be decided before
 * the code is handed over — see AuthService.verify.
 *
 * 410 Gone rather than 400: the code was valid and no longer is.
 */
export class OtpExpiredError extends ApiError {
    constructor(message = 'Verification code has expired.') {
        super(message, 410);
        this.name = 'OtpExpiredError';
    }
}

export class InternalServerError extends ApiError {
    constructor(message = 'Internal Server Error', details?: unknown) {
        super(message, 500, details);
        this.name = 'InternalServerError';
    }
}
