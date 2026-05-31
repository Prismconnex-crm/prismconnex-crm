import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/http/validate";
import { AuthService } from "@/services/auth.service";
import { jsonOk, jsonError } from "@/lib/http/response";

const signUpSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = validateBody(signUpSchema, body);

        await AuthService.signUp(data.email, data.password, data.name);

        return jsonOk({ success: true, message: "User created, please verify your email." }, 201);
    } catch (error) {
        return jsonError(error);
    }
}
