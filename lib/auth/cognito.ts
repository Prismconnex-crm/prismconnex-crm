import { CognitoJwtVerifier } from "aws-jwt-verify";

const userPoolId = process.env.COGNITO_USER_POOL_ID || "";
const clientId = process.env.COGNITO_CLIENT_ID || "";

// Only create a real verifier if env vars are present
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
if (userPoolId && clientId) {
    verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: "id",
        clientId,
    });
}

export async function verifyCognitoToken(token: string) {
    if (!verifier) return null;
    try {
        const payload = await verifier.verify(token);
        return payload;
    } catch (err) {
        console.error("Token not valid!", err);
        return null;
    }
}
