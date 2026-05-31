import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";

const verifySchema = z.object({
    email: z.string().email(),
    code: z.string().min(6),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = validateBody(verifySchema, body);

        await AuthService.verify(data.email, data.code);

        return jsonOk({ success: true, message: "Email verified successfully." });
    } catch (error) {
        return jsonError(error);
    }
}
