import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";

export type SessionPayload = {
  sub: string;
  email: string;
  workspaceId: string;
};

export async function signLocalSession(payload: SessionPayload) {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "prismconnex-dev-secret");
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

export async function verifyLocalSession(token: string) {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "prismconnex-dev-secret");
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as SessionPayload;
}

export async function verifyCognitoJwt(token: string) {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const region = process.env.COGNITO_REGION;

  if (!userPoolId || !region) return null;

  const jwks = createRemoteJWKSet(
    new URL(`https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`)
  );

  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  });

  return payload;
}

export function buildCognitoHostedUiUrl() {
  const domain = process.env.COGNITO_DOMAIN;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const redirectUri = process.env.COGNITO_REDIRECT_URI;

  if (!domain || !clientId || !redirectUri) return null;

  const url = new URL(`https://${domain}/login`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid email profile");
  return url.toString();
}
