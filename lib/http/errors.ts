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

export class ConflictError extends ApiError {
    constructor(message = 'Conflict') {
        super(message, 409);
        this.name = 'ConflictError';
    }
}

/**
 * Supabase accepted the request but its mailer (the project's SMTP) failed to
 * send. GoTrue reports this as a bare 500 "Error sending … email"; it is an
 * upstream outage from this app's point of view, hence 503.
 */
export class EmailDeliveryError extends ApiError {
    constructor(
        message = "We couldn't send the verification email right now. Please try again in a few minutes, or contact support if it keeps happening."
    ) {
        super(message, 503);
        this.name = 'EmailDeliveryError';
    }
}

export class InternalServerError extends ApiError {
    constructor(message = 'Internal Server Error', details?: unknown) {
        super(message, 500, details);
        this.name = 'InternalServerError';
    }
}

export class TooManyRequestsError extends ApiError {
    constructor(message = 'Too Many Requests', public retryAfterSeconds?: number) {
        super(message, 429, retryAfterSeconds ? { retryAfterSeconds } : undefined);
        this.name = 'TooManyRequestsError';
    }
}

/**
 * Correct password, but the signup OTP was never verified. A distinct code so
 * the sign-in form can send the user back to the verify step instead of just
 * showing text.
 */
export class EmailNotConfirmedError extends UnauthorizedError {
    constructor(message = 'Please verify your email address before signing in.') {
        super(message);
        this.name = 'EmailNotConfirmedError';
    }
}

/** The OTP was wrong, expired, or already used — GoTrue does not say which. */
export class InvalidOtpError extends BadRequestError {
    constructor(
        message = 'That verification code is invalid or has expired. Check the latest email or request a new code.'
    ) {
        super(message);
        this.name = 'InvalidOtpError';
    }
}
