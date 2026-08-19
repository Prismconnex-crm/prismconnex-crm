import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { requireSessionUser } from "@/lib/auth/require-session";
import { UpdatePreferencesSchema } from "@/models/profile";
import { ProfileService } from "@/services/profile.service";

/**
 * Saves the Preferences card.
 *
 * The theme is persisted here so the choice follows the user across devices,
 * but next-themes remains the source of truth in the browser: the client sets
 * it immediately on change and this row is what restores it on a fresh device.
 * Persisting only, without the client call, would leave the page unchanged
 * until reload; setting only, without persisting, would forget it on the next
 * machine. Both are needed, and the client does both.
 */
export async function PATCH(request: Request) {
    try {
        const { userId } = await requireSessionUser();
        const data = validateBody(UpdatePreferencesSchema, await request.json());

        const profile = await ProfileService.updatePreferences(userId, data);

        return jsonOk({ profile, message: "Preferences updated." });
    } catch (error) {
        return jsonError(error);
    }
}
