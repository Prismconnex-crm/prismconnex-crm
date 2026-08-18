import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// Employee lookup for a single company, proxied server-side so the ContactOut
// token never reaches the browser.
//
// NOTE ON SOURCE: the docs link for "Contact Info API (single)"
// (GET /v1/people/linkedin) enriches ONE person from a LinkedIn profile URL —
// it cannot list a company's employees. Listing employees for a company is the
// People Search API (POST /v1/people/search), which accepts company/domain
// filters, so that is what this route calls. ContactOut is credit-metered
// (credits per profile returned, per email, per phone), which is why this runs
// on demand for the clicked company instead of pre-filling all 36.49M rows.

const CONTACTOUT_SEARCH_URL = "https://api.contactout.com/v1/people/search";
const DEFAULT_LIMIT = 10;

type Employee = {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
};

// The search payload nests contact data differently depending on plan/flags, so
// pull each field from the documented shape with tolerant fallbacks.
function firstString(value: unknown): string {
  if (Array.isArray(value)) {
    const found = value.find((item) => typeof item === "string" && item.trim());
    return typeof found === "string" ? found : "";
  }
  return typeof value === "string" ? value : "";
}

function mapProfile(profile: Record<string, any>): Employee {
  const contact = profile.contact_info ?? profile.contactInfo ?? profile;
  return {
    name: firstString(profile.full_name ?? profile.name) || "",
    title: firstString(profile.title ?? profile.headline ?? profile.job_title) || "",
    email:
      firstString(contact.work_email) ||
      firstString(contact.email) ||
      firstString(contact.personal_email),
    phone: firstString(contact.phone ?? contact.phone_number),
    location: firstString(profile.location ?? profile.country ?? profile.region),
    linkedin: firstString(profile.li_vanity ? `https://linkedin.com/in/${profile.li_vanity}` : profile.url ?? profile.linkedin_url),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company")?.trim();
    const domain = searchParams.get("domain")?.trim();
    const companyId = searchParams.get("companyId")?.trim();
    const limit = Math.min(25, Math.max(1, Number.parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

    if (!company && !domain && !companyId) {
      return NextResponse.json({ error: "company, domain or companyId is required" }, { status: 400 });
    }

    // 1) Stored contacts win: first-party/verified records entered manually, plus
    //    anything a previous provider lookup cached. Avoids re-paying for a company.
    if (companyId) {
      const stored = await prisma.companyContact.findMany({
        where: { companyId },
        orderBy: { fullName: "asc" },
        take: limit,
      });
      if (stored.length > 0) {
        return NextResponse.json({
          configured: true,
          source: "database",
          employees: stored.map((contact) => ({
            name: contact.fullName,
            title: contact.jobTitle ?? "",
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            location: contact.location ?? "",
            linkedin: contact.linkedinUrl ?? "",
          })),
        });
      }
    }

    // 2) Nothing stored — fall back to the provider lookup.
    const token = process.env.CONTACTOUT_API_KEY;
    if (!token) {
      // Not an error state for the UI — it renders a "connect ContactOut" notice.
      return NextResponse.json({
        configured: false,
        employees: [],
        message:
          "ContactOut API key not configured. Set CONTACTOUT_API_KEY in .env to load employee details.",
      });
    }

    // Prefer domain (unambiguous) and fall back to the company name.
    const body: Record<string, unknown> = {
      page: 1,
      reveal_info: true,
      current_company_only: true,
    };
    if (domain) body.domain = [domain];
    else if (company) body.company = [company];

    const response = await fetch(CONTACTOUT_SEARCH_URL, {
      method: "POST",
      headers: {
        token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        {
          configured: true,
          employees: [],
          error: `ContactOut request failed (${response.status})`,
          detail: detail.slice(0, 300),
        },
        { status: response.status === 401 || response.status === 403 ? 502 : response.status }
      );
    }

    const data = await response.json();
    const profiles: Record<string, any>[] = Array.isArray(data?.profiles)
      ? data.profiles
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.results)
          ? data.results
          : [];

    const employees = profiles
      .map(mapProfile)
      .filter((employee) => employee.name)
      .slice(0, limit);

    return NextResponse.json({ configured: true, employees });
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json(
      { configured: true, employees: [], error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}
