import { jsonOk, jsonError } from "@/lib/http/response";
import { validateBody } from "@/lib/http/validate";
import { requireSessionUser } from "@/lib/auth/require-session";
import { UpdateProfessionalInfoSchema } from "@/models/profile";
import { ProfileService } from "@/services/profile.service";

/** Saves the Professional Information card. */
export async function PATCH(request: Request) {
    try {
        const { userId } = await requireSessionUser();
        const data = validateBody(UpdateProfessionalInfoSchema, await request.json());

        const profile = await ProfileService.updateProfessionalInfo(userId, data);

        return jsonOk({ profile, message: "Professional information updated." });
    } catch (error) {
        return jsonError(error);
    }
}
