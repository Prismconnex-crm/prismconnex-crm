import { jsonOk, jsonError } from "@/lib/http/response";
import { BadRequestError } from "@/lib/http/errors";
import { requireSessionUser } from "@/lib/auth/require-session";
import { requireSupabaseAccessToken } from "@/lib/supabase/access-token";
import { ProfileService } from "@/services/profile.service";
import {
    deleteAvatarObject,
    objectKeyFromPublicUrl,
    uploadAvatar,
} from "@/lib/supabase/storage";

/**
 * Profile photo upload and removal.
 *
 * multipart/form-data rather than a JSON data-URI: base64 inflates the payload
 * by a third and would have to be decoded in memory before it could be checked
 * against the size limit, i.e. after the cost has already been paid.
 *
 * The object key is built from the SESSION's user id inside uploadAvatar, never
 * from anything in the form, so a crafted request cannot write into another
 * user's folder — and the bucket's RLS policy independently enforces the same
 * rule against the user's own token.
 */
export async function POST(request: Request) {
    try {
        const { userId } = await requireSessionUser();
        const accessToken = await requireSupabaseAccessToken();

        const form = await request.formData().catch(() => null);
        const file = form?.get("file");

        if (!file || typeof file === "string") {
            throw new BadRequestError("Choose an image file to upload.");
        }

        const existing = await ProfileService.requireByUserId(userId);

        const { publicUrl } = await uploadAvatar({
            accessToken,
            userId,
            file: file as unknown as {
                type: string;
                size: number;
                arrayBuffer(): Promise<ArrayBuffer>;
            },
        });

        const profile = await ProfileService.setAvatarUrl(userId, publicUrl);

        // Delete the old object only AFTER the row points at the new one, so a
        // failure between the two leaves a stale file rather than a profile
        // whose avatar_url points at something that no longer exists.
        const previousKey = objectKeyFromPublicUrl(existing.avatarUrl);
        if (previousKey) await deleteAvatarObject(accessToken, previousKey);

        return jsonOk({ profile, message: "Profile photo updated." });
    } catch (error) {
        return jsonError(error);
    }
}

/** Removes the photo: clears the column, then deletes the object. */
export async function DELETE() {
    try {
        const { userId } = await requireSessionUser();
        const accessToken = await requireSupabaseAccessToken();

        const existing = await ProfileService.requireByUserId(userId);
        const key = objectKeyFromPublicUrl(existing.avatarUrl);

        const profile = await ProfileService.setAvatarUrl(userId, null);
        if (key) await deleteAvatarObject(accessToken, key);

        return jsonOk({ profile, message: "Profile photo removed." });
    } catch (error) {
        return jsonError(error);
    }
}
