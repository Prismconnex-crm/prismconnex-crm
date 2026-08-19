import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { requireSessionUser } from "@/lib/auth/require-session";
import { UpdateNotificationsSchema } from "@/models/profile";
import { ProfileService } from "@/services/profile.service";

/**
 * Saves the Notification Settings card.
 *
 * These are stored preferences only — nothing in this codebase sends email,
 * SMS or push yet, so switching one on records an intent rather than starting
 * a delivery. The UI says so, because a toggle that silently does nothing is
 * worse than an absent one.
 */
export async function PATCH(request: Request) {
    try {
        const { userId } = await requireSessionUser();
        const data = validateBody(UpdateNotificationsSchema, await request.json());

        const profile = await ProfileService.updateNotifications(userId, data);

        return jsonOk({ profile, message: "Notification settings updated." });
    } catch (error) {
        return jsonError(error);
    }
}
