import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for OAuth tokens at rest (and the short-lived OAuth state
 * cookie). Server-only.
 *
 * Format: `v1.<iv>.<tag>.<ciphertext>`, each base64url. The key is SHA-256 of
 * INTEGRATIONS_ENCRYPTION_KEY, so any sufficiently long random string works.
 * GCM authenticates, so a tampered value or the wrong key throws instead of
 * returning garbage.
 */

function deriveKey(keyMaterial: string) {
    return createHash("sha256").update(keyMaterial, "utf8").digest();
}

export function encryptSecret(plaintext: string, keyMaterial: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", deriveKey(keyMaterial), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return ["v1", iv, tag, ciphertext].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(sealed: string, keyMaterial: string) {
    const [version, iv, tag, ciphertext] = sealed.split(".");
    if (version !== "v1" || !iv || !tag || ciphertext === undefined) {
        throw new Error("Malformed encrypted value");
    }

    const decipher = createDecipheriv("aes-256-gcm", deriveKey(keyMaterial), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));

    return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64url")),
        decipher.final(),
    ]).toString("utf8");
}
