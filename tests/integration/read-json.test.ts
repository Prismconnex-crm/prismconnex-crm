import { describe, it, expect, vi, afterEach } from "vitest";
import { readJsonResponse } from "@/lib/http/read-json";

/**
 * Regression cover for "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
 * on the sign-in form.
 *
 * Next serves the Pages Router `_error` document — HTML — when an App Router
 * route fails to compile or throws before the handler runs. The auth forms used
 * to call res.json() on that, which threw a SyntaxError and replaced the real
 * failure with a parse error.
 */

const NEXT_ERROR_PAGE =
    '<!DOCTYPE html><html><head><style data-next-hide-fouc="true">body{display:none}' +
    "</style></head><body><h1>500</h1></body></html>";

function htmlResponse(status = 500) {
    return new Response(NEXT_ERROR_PAGE, {
        status,
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("readJsonResponse", () => {
    it("returns null instead of throwing when the body is Next's HTML error page", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(readJsonResponse(htmlResponse())).resolves.toBeNull();
    });

    it("logs the status and content type so the real failure stays diagnosable", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        await readJsonResponse(htmlResponse(500));

        expect(spy).toHaveBeenCalledOnce();
        const message = String(spy.mock.calls[0]?.[0]);
        expect(message).toContain("text/html");
        expect(message).toContain("HTTP 500");
    });

    it("parses a normal jsonError envelope", async () => {
        const body = { error: { message: "Invalid email or password", code: "UnauthorizedError" } };
        const res = new Response(JSON.stringify(body), {
            status: 401,
            headers: { "content-type": "application/json" },
        });

        await expect(readJsonResponse(res)).resolves.toEqual(body);
    });

    it("parses a successful sign-in payload", async () => {
        const res = new Response(JSON.stringify({ ok: true, onboarded: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
        });

        await expect(readJsonResponse(res)).resolves.toEqual({ ok: true, onboarded: true });
    });

    it("returns null for an empty body (204, or a proxy that sends nothing)", async () => {
        // 204 must be constructed with a null body — the spec forbids a payload.
        await expect(readJsonResponse(new Response(null, { status: 204 }))).resolves.toBeNull();
        await expect(readJsonResponse(new Response("", { status: 200 }))).resolves.toBeNull();
    });
});
