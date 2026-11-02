import type { EventExhibitor } from "@prisma/client";

/**
 * One EventExhibitor row as the CRM Exhibitors tab reads it (types/exhibitors.ts). Shared by /api/exhibitors
 * and /api/exhibitors/resolve so a card and an exhibitor opened after sign-in carry the same fields.
 */
export function toExhibitorItem(row: EventExhibitor) {
  return {
    id: row.id,
    name: row.companyName,
    logoUrl: row.logoUrl,
    stand: row.standNumber,
    // Prefer the company's own site; the UI falls back to the source
    // directory page when there isn't one.
    website: row.websiteUrl,
    profileUrl: row.sourceDetailUrl,
    directoryUrl: row.sourceDirectoryUrl,
    country: row.country,
    phone: row.phone,
    companyLinkedInUrl: row.companyLinkedInUrl,
    description: row.description,
    categories: row.categories,
    firstName: row.firstName,
    lastName: row.lastName,
    designation: row.designation,
    email: row.email,
    personLinkedInUrl: row.personLinkedInUrl,
  };
}
