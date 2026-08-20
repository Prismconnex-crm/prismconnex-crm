import { randomBytes } from "node:crypto";
import {
    ApiError,
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    UnauthorizedError,
} from "@/lib/http/errors";
import { readSupabaseConfig } from "@/lib/supabase/config";

/**
 * Avatar objects in the Supabase Storage `avatars` bucket.
 *
 * Same shape as lib/supabase/gotrue.ts — a thin REST wrapper rather than
 * @supabase/supabase-js, because the project avoids new installs and the
 * Storage API is a handful of plain HTTP calls.
 *
 * ── The one rule that matters ──
 * Every object key is `<userId>/<random>.<ext>`, and every request is made with
 * the USER's access token, not the anon key. The bucket's RLS policies (see
 * supabase/sql/003_avatars_storage.sql) compare the first path segment to
 * auth.uid(), so the database is what actually stops one user writing over
 * another's photo. The userId here is taken from the verified session, never
 * from the request body — pass it from getSessionPayload() and nothing else.
 *
 * The random filename (not a fixed "avatar.png") is what makes replacement work
 * with a public bucket: reusing one key means the CDN keeps serving the old
 * image until its cache expires, which reads as "the upload silently failed".
 */

const BUCKET = "avatars";

/**
 * Mirrors the bucket's own allowed_mime_types. Both layers are deliberate.
 *
 * `image/jpg` is not a real IANA type, but some Windows builds and older
 * browsers still report it for a .jpg, so it is accepted and normalised here.
 * The bucket list must contain it too, or those uploads pass this check and are
 * then rejected by Storage.
 */
const ALLOWED_MIME: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
};

export const ALLOWED_FORMATS_LABEL = "PNG, JPEG, WebP or GIF";

/** Mirrors the bucket's file_size_limit (5 MiB). */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function config() {
    return readSupabaseConfig("Storage");
}

/**
 * Validates before uploading, so the user gets a sentence instead of the
 * bucket's raw 400. The bucket enforces the same limits regardless — this is
 * the readable half of a check that exists in both places.
 */
export function assertUploadableAvatar(file: { type: string; size: number }) {
    const extension = ALLOWED_MIME[file.type?.toLowerCase()];
    if (!extension) {
        throw new BadRequestError(
            `Unsupported image format. Use ${ALLOWED_FORMATS_LABEL}.`
        );
    }

    if (file.size > MAX_AVATAR_BYTES) {
        throw new BadRequestError("Image is larger than 5 MB. Choose a smaller file.");
    }

    if (file.size === 0) {
        throw new BadRequestError("The selected file is empty.");
    }

    return extension;
}

/** `https://<project>.supabase.co/storage/v1/object/public/avatars/<key>` */
function publicUrlFor(objectKey: string) {
    const { url } = config();
    return `${url}/storage/v1/object/public/${BUCKET}/${objectKey}`;
}

/**
 * Recovers the object key from a stored public URL, or null when the URL does
 * not point at this bucket.
 *
 * Used to delete the file behind an existing avatar_url. Returns null rather
 * than throwing for foreign URLs (an OAuth provider's avatar, say), because
 * "there is nothing of ours to delete" is a normal outcome, not an error.
 */
export function objectKeyFromPublicUrl(avatarUrl: string | null): string | null {
    if (!avatarUrl) return null;

    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = avatarUrl.indexOf(marker);
    if (index === -1) return null;

    const key = avatarUrl.slice(index + marker.length).split("?")[0];
    return key || null;
}

/**
 * What Supabase Storage puts in a failure body.
 *
 * The important part: `statusCode` here is a STRING and it does NOT have to
 * match the HTTP status. A missing bucket is served as `HTTP 400` carrying
 * `{"statusCode":"404","code":"NoSuchBucket"}`, and an RLS rejection as
 * `HTTP 400` carrying `{"statusCode":"403"}`. Branching on res.status therefore
 * silently misses both, which is exactly how every failure here used to
 * collapse into one unhelpful "please try again".
 */
type StorageErrorBody = {
    statusCode?: string;
    error?: string;
    message?: string;
    code?: string;
};

function parseStorageError(text: string): StorageErrorBody | null {
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" ? (parsed as StorageErrorBody) : null;
    } catch {
        return null;
    }
}

/**
 * Turns a Storage failure into the sentence the user should read.
 *
 * Every branch is driven by the body first and the HTTP status only as a
 * fallback, per the note on StorageErrorBody. The messages name a cause the
 * reader can act on; the raw error is logged by the caller, never returned.
 */
function describeStorageFailure(
    httpStatus: number,
    body: StorageErrorBody | null
): ApiError {
    const status = Number(body?.statusCode) || httpStatus;
    const code = (body?.code ?? body?.error ?? "").toLowerCase();
    const message = (body?.message ?? "").toLowerCase();

    // Missing bucket — by far the most likely first-run failure, and one no
    // amount of retrying fixes. Name the fix instead of reporting "not found".
    if (status === 404 || code.includes("nosuchbucket") || message.includes("bucket not found")) {
        return new InternalServerError(
            "Profile image storage is not configured: the 'avatars' bucket does not exist. " +
                "Run supabase/sql/003_avatars_storage.sql in the Supabase SQL editor."
        );
    }

    // RLS said no. Either the policies were never created, or the object key's
    // first segment is not the caller's uid — both are server-side faults, so
    // the user gets the plain sentence and the detail goes to the log.
    if (
        status === 403 ||
        code.includes("unauthorized") ||
        message.includes("row-level security")
    ) {
        return new ForbiddenError("You are not authorized to upload this image.");
    }

    if (status === 401) {
        return new UnauthorizedError("Your session has expired. Please sign in again.");
    }

    if (status === 413 || code.includes("entitytoolarge") || message.includes("exceeded the maximum")) {
        return new BadRequestError("Image is larger than 5 MB. Choose a smaller file.");
    }

    if (status === 415 || code.includes("mime") || message.includes("mime type")) {
        return new BadRequestError(
            `Unsupported image format. Use ${ALLOWED_FORMATS_LABEL}.`
        );
    }

    return new InternalServerError("Upload failed. Please try again.");
}

/**
 * Uploads the avatar and returns its public URL.
 *
 * `x-upsert: true` so a retry of the same key overwrites instead of 409-ing;
 * keys are random, so this only ever matters on a retry of one request.
 */
export async function uploadAvatar(params: {
    accessToken: string;
    userId: string;
    file: { type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };
}): Promise<{ publicUrl: string; objectKey: string }> {
    const extension = assertUploadableAvatar(params.file);
    const { url, anonKey } = config();

    const objectKey = `${params.userId}/${randomBytes(16).toString("hex")}.${extension}`;
    const body = Buffer.from(await params.file.arrayBuffer());

    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectKey}`, {
        method: "POST",
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${params.accessToken}`,
            "Content-Type": params.file.type,
            "x-upsert": "true",
        },
        body,
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        const body = parseStorageError(text);

        // The developer-facing record: the whole truth, server-side only. The
        // thrown message below is the sanitised half the user sees.
        console.error("Profile image upload error:", {
            httpStatus: res.status,
            storageStatus: body?.statusCode,
            code: body?.code ?? body?.error,
            message: body?.message ?? text,
            objectKey,
        });

        throw describeStorageFailure(res.status, body);
    }

    return { publicUrl: publicUrlFor(objectKey), objectKey };
}

/**
 * Deletes an avatar object. Never throws.
 *
 * Called both by "Remove photo" and to clean up the previous file after a
 * replacement. A failure here must not fail the request: the profile row is the
 * source of truth for which avatar is shown, so a leaked object is untidy,
 * while a 500 on an otherwise-successful update is a broken feature.
 */
export async function deleteAvatarObject(accessToken: string, objectKey: string) {
    try {
        const { url, anonKey } = config();

        const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectKey}`, {
            method: "DELETE",
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("[storage] avatar delete failed", res.status, objectKey);
        }
    } catch (error) {
        console.error("[storage] avatar delete threw", error);
    }
}
