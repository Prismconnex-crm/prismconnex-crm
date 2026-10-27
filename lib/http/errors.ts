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

export class InternalServerError extends ApiError {
    constructor(message = 'Internal Server Error', details?: unknown) {
        super(message, 500, details);
        this.name = 'InternalServerError';
    }
}

export class ConflictError extends ApiError {
    constructor(message = 'Conflict') {
        super(message, 409);
        this.name = 'ConflictError';
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

/** The auth provider accepted the request but could not send the email. */
export class EmailDeliveryError extends ApiError {
    constructor(
        message = "We couldn't send the verification email. Email delivery is not working on the server right now — please try again later."
    ) {
        super(message, 503);
        this.name = 'EmailDeliveryError';
    }
}
