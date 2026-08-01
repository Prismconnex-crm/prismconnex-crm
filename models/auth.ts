import { z } from 'zod';

/**
 * Client-side auth schemas.
 *
 * These mirror the server contracts in `app/api/auth/*` but are intentionally
 * separate: the API routes keep their own schemas as the source of truth, and
 * these exist purely to surface inline field errors before the request is sent.
 *
 * Schemas are built by factories so validation messages can be localized —
 * pass the `next-intl` translator scoped to `auth.signIn` / `auth.signUp`.
 */

type Translator = (key: string) => string;

/**
 * Indian mobile numbers: 10 digits starting 6-9, optionally prefixed with
 * +91 / 91 / 0 and an optional space or hyphen separator.
 */
export const INDIAN_PHONE_PATTERN = /^(?:\+?91[-\s]?|0)?[6-9]\d{9}$/;

/** Matches the `z.string().email()` behaviour used by the sign-up API route. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isIndianPhone(value: string) {
  return INDIAN_PHONE_PATTERN.test(value.replace(/\s+/g, ''));
}

export function isEmail(value: string) {
  return EMAIL_PATTERN.test(value);
}

/**
 * Sign-in accepts either an email address or an Indian phone number in the
 * same field. The value is still POSTed as `email` — the API contract is
 * unchanged.
 */
export function createSignInSchema(t: Translator) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, t('validation.identifierRequired'))
      .refine((value) => isEmail(value) || isIndianPhone(value), {
        message: t('validation.identifierInvalid'),
      }),
    password: z.string().min(1, t('validation.passwordRequired')),
  });
}

export function createSignUpSchema(t: Translator) {
  return z
    .object({
      firstName: z.string().trim().min(1, t('validation.firstNameRequired')),
      middleName: z.string().trim().optional(),
      lastName: z.string().trim().min(1, t('validation.lastNameRequired')),
      email: z
        .string()
        .trim()
        .min(1, t('validation.emailRequired'))
        .refine(isEmail, { message: t('validation.emailInvalid') }),
      phone: z
        .string()
        .trim()
        .min(1, t('validation.phoneRequired'))
        .refine(isIndianPhone, { message: t('validation.phoneInvalid') }),
      // Matches the server rule in app/api/auth/sign-up/route.ts
      password: z.string().min(8, t('validation.passwordMin')),
      confirmPassword: z.string().min(1, t('validation.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    });
}

export type SignInInput = z.infer<ReturnType<typeof createSignInSchema>>;
export type SignUpInput = z.infer<ReturnType<typeof createSignUpSchema>>;

/** Flattens a ZodError into the `{ field: message }` shape the forms render. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

/** Joins name parts into the single `name` string the sign-up API expects. */
export function composeFullName(parts: {
  firstName: string;
  middleName?: string;
  lastName: string;
}) {
  return [parts.firstName, parts.middleName, parts.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}
