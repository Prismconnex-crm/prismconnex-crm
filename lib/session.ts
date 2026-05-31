import { cookies } from "next/headers";
import { verifyCognitoJwt, verifyLocalSession } from "@/lib/auth";

export async function requireSession() {
  const token = cookies().get("pcx_session")?.value;
  if (!token) return null;

  try {
    return await verifyLocalSession(token);
  } catch {
    try {
      const payload = await verifyCognitoJwt(token);
      if (!payload) return null;
      return {
        sub: String(payload.sub || ""),
        email: String(payload.email || ""),
        workspaceId: String(payload["custom:workspaceId"] || "default"),
      };
    } catch {
      return null;
    }
  }
}
