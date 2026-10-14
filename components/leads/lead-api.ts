import { readJsonResponse, type ApiErrorBody } from "@/lib/http/read-json";
import type { LeadDTO, LeadDetailDTO, LeadListDTO, LeadNoteDTO } from "@/models/lead";
import type { WorkspaceMembersResponse } from "@/models/workspace-member";

/**
 * Browser client for the lead API. Every call throws an Error carrying the
 * server's own message (e.g. "The selected owner is not a member of this
 * workspace."), so components can show it verbatim.
 */
async function request<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(url, {
        method: init?.method ?? "GET",
        headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
    });
    const data = await readJsonResponse<T & ApiErrorBody>(res);

    if (!res.ok) {
        throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
    }
    return data as T;
}

/** The editable fields, as the form holds them. */
export type LeadInput = {
    fullName: string;
    email: string;
    phone: string;
    jobTitle: string;
    companyName: string;
    source: string;
    status: string;
    score: number;
    ownerId: string | null;
    nextFollowUpAt: string;
};

export type LeadListParams = {
    q?: string;
    status?: string;
    owner?: string;
    cursor?: string;
};

export const leadApi = {
    list(params: LeadListParams) {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value) search.set(key, value);
        }
        return request<LeadListDTO>(`/api/leads?${search.toString()}`);
    },
    get(id: string) {
        return request<LeadDetailDTO>(`/api/leads/${encodeURIComponent(id)}`);
    },
    create(input: LeadInput) {
        return request<LeadDTO>("/api/leads", { method: "POST", body: input });
    },
    update(id: string, input: Partial<LeadInput>) {
        return request<LeadDTO>(`/api/leads/${encodeURIComponent(id)}`, { method: "PATCH", body: input });
    },
    remove(id: string) {
        return request<{ ok: true }>(`/api/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    addNote(id: string, body: string) {
        return request<LeadNoteDTO>(`/api/leads/${encodeURIComponent(id)}/notes`, {
            method: "POST",
            body: { body },
        });
    },
    convert(id: string, input: { dealName: string; amount: number }) {
        return request<{ id: string; name: string }>(`/api/leads/${encodeURIComponent(id)}/convert`, {
            method: "POST",
            body: input,
        });
    },
    members() {
        return request<WorkspaceMembersResponse>("/api/workspace/members");
    },
};
