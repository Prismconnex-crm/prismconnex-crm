/**
 * Per-company contact lists imported from spreadsheets
 * (scripts/import-company-contacts-xlsx.mjs → data/company-contacts/<domain>.json).
 *
 * A company with a list here gets the full People table on its exhibitor
 * profile; every other company keeps the single directory-contact card. Lists
 * are keyed by bare domain because that is unique, where a trading name is not.
 *
 * Pure module — no database — so tests can import it directly.
 */
import acebott from "@/data/company-contacts/acebott.com.json";
import acer from "@/data/company-contacts/acer.com.json";
import actionMats from "@/data/company-contacts/actionmats.co.uk.json";
import activeFloor from "@/data/company-contacts/activefloor.com.json";
import agLockdown from "@/data/company-contacts/aglockdown.com.json";
import aiTutoring from "@/data/company-contacts/aitutoring.me.json";
import abStudios from "@/data/company-contacts/abstudios.com.json";
import fourMatrix from "@/data/company-contacts/4matrixcloud.com.json";
import airia from "@/data/company-contacts/airia.com.json";
import albion from "@/data/company-contacts/albion.co.uk.json";
import anton from "@/data/company-contacts/anton.app.json";
import aqa from "@/data/company-contacts/aqa.org.uk.json";
import aresline from "@/data/company-contacts/aresline.com.json";
import aspiraCloud from "@/data/company-contacts/aspiracloud.com.json";
import audiebant from "@/data/company-contacts/audiebant.co.uk.json";
import avocor from "@/data/company-contacts/avocor.com.json";
import benMaker from "@/data/company-contacts/benmaker.com.json";
import blocksi from "@/data/company-contacts/blocksi.net.json";
import briskTeaching from "@/data/company-contacts/briskteaching.com.json";
import bromcom from "@/data/company-contacts/bromcom.com.json";
import cardExchange from "@/data/company-contacts/cardexchangeid.com.json";
import carolina from "@/data/company-contacts/carolina.com.json";
import clarion from "@/data/company-contacts/clarioncomms.com.json";
import classDojo from "@/data/company-contacts/classdojo.com.json";
import classera from "@/data/company-contacts/classera.com.json";
import classLink from "@/data/company-contacts/classlink.com.json";
import classroomscreen from "@/data/company-contacts/classroomscreen.com.json";
import clever from "@/data/company-contacts/clever.com.json";
import cloudDesignBox from "@/data/company-contacts/clouddesignbox.co.uk.json";
import codeMonkey from "@/data/company-contacts/codemonkey.com.json";
import cosafe from "@/data/company-contacts/cosafe.com.json";
import compro from "@/data/company-contacts/comprotechnologies.com.json";
import cpoms from "@/data/company-contacts/cpoms.co.uk.json";
import crbCunninghams from "@/data/company-contacts/crbcunninghams.co.uk.json";
import crickSoftware from "@/data/company-contacts/cricksoft.com.json";
import dataHarvest from "@/data/company-contacts/data-harvest.co.uk.json";
import deesha from "@/data/company-contacts/deesha.ai.json";
import dily from "@/data/company-contacts/dilyclass.com.json";
import docex from "@/data/company-contacts/docex360.co.uk.json";
import edpuzzle from "@/data/company-contacts/edpuzzle.com.json";
import eduSofx from "@/data/company-contacts/edusofx.com.json";
// 2026-11-22 batch of 18 (owner's order).
import eduflix from "@/data/company-contacts/eduflix.com.json";
import eduTechGlobal from "@/data/company-contacts/edutech.global.json";
import epson from "@/data/company-contacts/epson.co.uk.json";
import eset from "@/data/company-contacts/eset.com.json";
import everybodyCounts from "@/data/company-contacts/everybodycounts.org.uk.json";
import fortinet from "@/data/company-contacts/fortinet.com.json";
import gecko from "@/data/company-contacts/geckoengage.com.json";
import globisens from "@/data/company-contacts/globisens.net.json";
import etapa from "@/data/company-contacts/etapa.com.br.json";
import hp from "@/data/company-contacts/hp.com.json";
import hyett from "@/data/company-contacts/hyetteducation.com.json";
import iScreamMedia from "@/data/company-contacts/i-screammedia.com.json";
import ictDirect from "@/data/company-contacts/ict-direct.co.uk.json";
import indivitech from "@/data/company-contacts/indivi.tech.json";
import indota from "@/data/company-contacts/indota.com.json";
import infento from "@/data/company-contacts/infento.com.json";
import intel from "@/data/company-contacts/intel.com.json";
import interactive365 from "@/data/company-contacts/interactive365.co.uk.json";
import communityPlaythings from "@/data/company-contacts/communityplaythings.co.uk.json";

export type CompanyContact = {
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  email: string | null;
  mobile: string | null;
  country: string | null;
  personLinkedInUrl: string | null;
  companyLinkedInUrl: string | null;
  /** Telegram / messaging link, only when a source actually provides one. */
  messagingUrl?: string | null;
};

type ContactFile = { domain: string; source: string; contacts: CompanyContact[] };

const CONTACT_FILES: Record<string, ContactFile> = {
  [acebott.domain]: acebott as ContactFile,
  [acer.domain]: acer as ContactFile,
  // Empty until a real Action Mats export arrives; the directory contact fills the table meanwhile.
  [actionMats.domain]: actionMats as ContactFile,
  [activeFloor.domain]: activeFloor as ContactFile,
  [agLockdown.domain]: agLockdown as ContactFile,
  // The BETT record has no website, so this is reached via NAME_FALLBACKS.
  [aiTutoring.domain]: aiTutoring as ContactFile,
  [abStudios.domain]: abStudios as ContactFile,
  // Keyed by the BETT record's website (4matrixcloud.com), not the CSV's 4matrix.com.
  [fourMatrix.domain]: fourMatrix as ContactFile,
  [airia.domain]: airia as ContactFile,
  [albion.domain]: albion as ContactFile,
  [anton.domain]: anton as ContactFile,
  [aqa.domain]: aqa as ContactFile,
  [aresline.domain]: aresline as ContactFile,
  [aspiraCloud.domain]: aspiraCloud as ContactFile,
  [audiebant.domain]: audiebant as ContactFile,
  [avocor.domain]: avocor as ContactFile,
  [benMaker.domain]: benMaker as ContactFile,
  [blocksi.domain]: blocksi as ContactFile,
  // Imported with --only-company: the sheet also lists three Blocksi Inc people.
  [briskTeaching.domain]: briskTeaching as ContactFile,
  [bromcom.domain]: bromcom as ContactFile,
  [cardExchange.domain]: cardExchange as ContactFile,
  [carolina.domain]: carolina as ContactFile,
  [clarion.domain]: clarion as ContactFile,
  [classDojo.domain]: classDojo as ContactFile,
  [classera.domain]: classera as ContactFile,
  [classLink.domain]: classLink as ContactFile,
  [classroomscreen.domain]: classroomscreen as ContactFile,
  [clever.domain]: clever as ContactFile,
  [cloudDesignBox.domain]: cloudDesignBox as ContactFile,
  [codeMonkey.domain]: codeMonkey as ContactFile,
  [communityPlaythings.domain]: communityPlaythings as ContactFile,
  [cosafe.domain]: cosafe as ContactFile,
  // Hand-corrected after import (see the file's "source" note): re-importing
  // would bring back Ravi Ranjan's shifted row.
  [compro.domain]: compro as ContactFile,
  [cpoms.domain]: cpoms as ContactFile,
  [crbCunninghams.domain]: crbCunninghams as ContactFile,
  [crickSoftware.domain]: crickSoftware as ContactFile,
  // Includes two doubtful rows kept on the owner's "delete nothing" rule:
  // a "Yes Yes Yes…" name and a Kenyan post-harvest manager.
  [dataHarvest.domain]: dataHarvest as ContactFile,
  [deesha.domain]: deesha as ContactFile,
  [dily.domain]: dily as ContactFile,
  [docex.domain]: docex as ContactFile,
  [edpuzzle.domain]: edpuzzle as ContactFile,
  [eduSofx.domain]: eduSofx as ContactFile,
  [eduflix.domain]: eduflix as ContactFile,
  // Hand-corrected after import: Nimat Asunogie's row was shifted.
  [eduTechGlobal.domain]: eduTechGlobal as ContactFile,
  [epson.domain]: epson as ContactFile,
  [eset.domain]: eset as ContactFile,
  [everybodyCounts.domain]: everybodyCounts as ContactFile,
  [fortinet.domain]: fortinet as ContactFile,
  [gecko.domain]: gecko as ContactFile,
  [globisens.domain]: globisens as ContactFile,
  [etapa.domain]: etapa as ContactFile,
  [hp.domain]: hp as ContactFile,
  [hyett.domain]: hyett as ContactFile,
  [iScreamMedia.domain]: iScreamMedia as ContactFile,
  [ictDirect.domain]: ictDirect as ContactFile,
  [indivitech.domain]: indivitech as ContactFile,
  [indota.domain]: indota as ContactFile,
  [infento.domain]: infento as ContactFile,
  [intel.domain]: intel as ContactFile,
  // Imported with --only-company: the sheet also lists an Intel employee.
  [interactive365.domain]: interactive365 as ContactFile,
};

/**
 * Companies whose paper-plane button opens the app's existing email workflow
 * (a mailto: link, as the Email column and exhibitor contact card use) for
 * contacts that have a real email. Nothing is sent automatically; contacts
 * without an email keep the inert button.
 */
const PAPER_PLANE_MAILTO = new Set(["briskteaching.com"]);

/**
 * Company name shown on every contact row, replacing the sheet's value — used
 * when the owner asked for the exhibitor's full name ("Albion Computers Plc")
 * where the export wrote a shorter one ("Albion Computers").
 */
const COMPANY_NAME_OVERRIDES: Record<string, string> = {
  "albion.co.uk": "Albion Computers Plc",
  "aresline.com": "Aresline",
  "benmaker.com": "BenMaker Early Age Education Equipment Industry Trade and Services Inc",
  "blocksi.net": "Blocksi",
};

/**
 * Mobile number shown on every contact of a company, replacing whatever the
 * sheet or directory had. Set by the owner's explicit instruction, kept here
 * rather than in the JSON so re-importing the sheet cannot drop it.
 */
const MOBILE_OVERRIDES: Record<string, string> = {
  // Owner-supplied 2026-11-18, reformatted 2026-11-22. Note: the BETT directory lists "45 31 700 729".
  "activefloor.com": "45 30 70 07 29",
  // Owner-supplied 2026-11-18; matches the BETT directory's "86 13378429333".
  "acebott.com": "86 133 7842 9333",
  // Owner-supplied 2026-11-18; matches the BETT directory's "44 203 518 7212".
  "aglockdown.com": "44 203 518 7212",
  // Owner-supplied 2026-11-19; matches the BETT directory's "1 914 220 2699".
  "airia.com": "1 914 220 2699",
  // Owner-supplied 2026-11-19; matches the BETT directory's "44 333 006 6025".
  "albion.co.uk": "44 333 006 6025",
  // Owner-supplied 2026-11-19; matches the BETT directory's "44 161 696 5995".
  "aqa.org.uk": "44 161 696 5995",
  // Owner-supplied 2026-11-19; matches the BETT directory's "39 0445 314931".
  "aresline.com": "39 0445 314931",
  // Owner-supplied 2026-11-19 (also stored in the JSON via --mobile); matches
  // the BETT directory's "44 24 7697 0550".
  "aspiracloud.com": "44 24 7697 0550",
  // Owner-supplied 2026-11-19 (also stored in the JSON via --mobile); matches
  // the BETT directory's "44 3331 882 324".
  "audiebant.co.uk": "44 3331 882 324",
  // Owner-supplied 2026-11-19 (also stored in the JSON via --mobile); matches
  // the BETT directory's "44 333 300 3457".
  "avocor.com": "44 333 300 3457",
  // Owner-supplied 2026-11-19 (also stored in the JSON via --mobile); matches
  // the BETT directory's "90 224 504 15 97".
  "benmaker.com": "90 224 504 15 97",
  // Owner-supplied 2026-11-19 (also stored in the JSON via --mobile); matches
  // the BETT directory's "1 877 693 4822".
  "blocksi.net": "1 877 693 4822",
  // Owner-supplied 2026-11-19 (also stored in the JSON via --mobile); matches
  // the BETT directory's "44 20 8290 7100".
  "bromcom.com": "+44 20 8290 7100",
  // Owner-supplied 2026-11-19 (also stored in the JSON via --mobile); matches
  // the BETT directory's "1 925-529-4999".
  "cardexchangeid.com": "+1 925-529-4999",
  // Owner-supplied 2026-11-19, used exactly as given (also stored via --mobile).
  // Note: one digit short of the BETT directory's "1 800-334-5551".
  "carolina.com": "1 800-334-551",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "44 333 222 6633".
  "clarioncomms.com": "44 333 222 6633",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "1 414 687 - 5892".
  "classera.com": "1 414 687-5892",
  // Owner-supplied 2026-11-19, as written (also stored via --mobile); same
  // digits as the BETT directory's "1 888 963-7550".
  "classlink.com": "1 888963-7550",
  // Owner-supplied 2026-11-19, used exactly as given (also stored via --mobile).
  // Note: the BETT directory has "1 877 578 5572" (…55… vs …56…).
  "clever.com": "1 877 578 5672",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "44 1482 688890".
  "clouddesignbox.co.uk": "44 1482 688890",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "1 888 299 3294".
  "codemonkey.com": "1 888 299 3294",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "44 1580 883310".
  "communityplaythings.co.uk": "44 1580 883310",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "46 840 940 020".
  "cosafe.com": "46 840 940 020",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "91 11 42011900".
  "comprotechnologies.com": "91 11 42011900",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "44 1756 79 7766".
  "cpoms.co.uk": "44 1756 79 7766",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "44 333 014 3065".
  "crbcunninghams.co.uk": "44 333 014 3065",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "44 1604 671691".
  "cricksoft.com": "44 1604 671691",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "44 1525 373666".
  "data-harvest.co.uk": "44 1525 373666",
  // Owner-supplied 2026-11-19 (also stored via --mobile); matches the BETT
  // directory's "44 1403 338608".
  "docex360.co.uk": "44 1403 338608",
  // 2026-11-22 batch — owner-supplied, each matches that company's BETT
  // directory phone; also stored in the JSON via --mobile.
  "eset.com": "44 1202 405 405",
  "fortinet.com": "+1-866-868-3678",
  "geckoengage.com": "44 131 541 2296",
  "hp.com": "1 650 857 1501",
  "hyetteducation.com": "44 7715579033",
  "i-screammedia.com": "+82-2-3440-2300",
  "ict-direct.co.uk": "44 1254 820 980",
  "indivi.tech": "90 539 843 77 54",
  "indota.com": "31 592 201 351",
  "infento.com": "31 20 261 64 50",
  "interactive365.co.uk": "44 20 3621 4714",
  // 2026-11-22 master list: first shared number for these two (also stored in the JSON).
  "4matrixcloud.com": "44 203 475 4463",
  "edpuzzle.com": "1 650 336 4934",
};

/** The show directory's own named contact, as stored on EventExhibitor. */
export type DirectoryContact = {
  firstName: string | null;
  lastName: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  personLinkedInUrl: string | null;
  companyLinkedInUrl: string | null;
  companyName: string;
};

/** Case- and punctuation-insensitive; keeps non-Latin letters (no `u` flag — tsconfig has no target). */
const nameKey = (name: string) =>
  name.toLowerCase().replace(/[\s.,'’\-_()/\\]+/g, "");

/**
 * Exhibitor name → contact-file domain, for exhibitor records that have no
 * website (so no domain to key on). Exact normalised name only.
 */
const NAME_FALLBACKS: Record<string, string> = {
  [nameKey("AITutoring.me")]: "aitutoring.me",
};

const blank = (value: string | null | undefined) => !value || !value.trim();

/**
 * A LinkedIn profile URL reduced to its /in/<slug>, so the same profile matches
 * across country subdomains, percent-encoding and trailing slashes.
 */
function linkedInKey(url: string | null | undefined): string | null {
  if (blank(url)) return null;
  let decoded = url!.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // keep the raw URL if it is not valid percent-encoding
  }
  const slug = decoded.toLowerCase().match(/linkedin\.com\/in\/([^/?#]+)/)?.[1];
  return slug ?? null;
}

/** Lower-case ASCII letters/digits only, accents folded ("Würtz" → "wurtz"). */
const asciiKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/**
 * Whether a LinkedIn /in/ URL plausibly belongs to the named person: its slug
 * contains their first or last name (or a 3+ letter part of either). Real
 * slugs vary ("cjsmith87", "schory", "robatkins1982") but always carry one.
 */
function linkedInBelongsTo(
  url: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined
): boolean {
  const slug = linkedInKey(url);
  if (!slug) return false;
  const slugKey = asciiKey(slug);
  const parts = [firstName, lastName]
    .flatMap((name) => (name ?? "").split(/[\s-]+/))
    .map(asciiKey)
    .filter((part) => part.length >= 3);
  return parts.some((part) => slugKey.includes(part));
}

/**
 * The contact-file key for an exhibitor: its domain, or — for exhibitors the
 * directory published without a website — an exact (normalised) company-name
 * match. The name fallback is never used when a domain exists.
 */
function resolveContactKey(domain: string | null, companyName?: string | null): string | null {
  return (
    domain?.toLowerCase() || (companyName ? NAME_FALLBACKS[nameKey(companyName)] : undefined) || null
  );
}

/**
 * Companies whose People table shows the LinkedIn + paper-plane pair on every
 * row, inert where the contact has no LinkedIn URL. Everyone else shows "-"
 * for a missing contact LinkedIn (the owner's instruction for Acer et al.).
 */
const ALWAYS_SHOW_CONTACT_ICONS = new Set([
  "acebott.com",
  "abstudios.com",
  "4matrixcloud.com",
  "airia.com",
  "aitutoring.me",
  "albion.co.uk",
  "anton.app",
  "aqa.org.uk",
  "aresline.com",
  "aspiracloud.com",
  "audiebant.co.uk",
  "avocor.com",
  "benmaker.com",
  "blocksi.net",
  "briskteaching.com",
  "bromcom.com",
  "cardexchangeid.com",
  "carolina.com",
  "clarioncomms.com",
  "classdojo.com",
  "classera.com",
  "classlink.com",
  "classroomscreen.com",
  "clever.com",
  "clouddesignbox.co.uk",
  "codemonkey.com",
  "communityplaythings.co.uk",
  "cosafe.com",
  "comprotechnologies.com",
  "cpoms.co.uk",
  "crbcunninghams.co.uk",
  "cricksoft.com",
  "data-harvest.co.uk",
  "deesha.ai",
  "dilyclass.com",
  "docex360.co.uk",
  "edpuzzle.com",
  "edusofx.com",
  "eduflix.com",
  "edutech.global",
  "epson.co.uk",
  "eset.com",
  "everybodycounts.org.uk",
  "fortinet.com",
  "geckoengage.com",
  "globisens.net",
  "etapa.com.br",
  "hp.com",
  "hyetteducation.com",
  "i-screammedia.com",
  "ict-direct.co.uk",
  "indivi.tech",
  "indota.com",
  "infento.com",
  "intel.com",
  "interactive365.co.uk",
]);

export function alwaysShowContactIcons(domain: string | null, companyName?: string | null): boolean {
  const key = resolveContactKey(domain, companyName);
  return key ? ALWAYS_SHOW_CONTACT_ICONS.has(key) : false;
}

/**
 * The imported list for a company domain, or null when none was imported.
 *
 * The directory's named contact is folded in rather than shown twice: when the
 * same person is already in the sheet, only the fields the sheet left empty
 * (email, phone, personal LinkedIn) are filled from the directory — the sheet's
 * own values, including job title, are never overwritten. When the directory
 * contact is not in the sheet, they are appended so no known contact is lost.
 * The company LinkedIn is company-level, so it fills every row that lacks one.
 */
export function getCompanyContacts(
  domain: string | null,
  directory?: DirectoryContact | null
): CompanyContact[] | null {
  const key = resolveContactKey(domain, directory?.companyName);
  if (!key) return null;
  const file = CONTACT_FILES[key];
  if (!file) return null;
  domain = key;

  const contacts = file.contacts.map((contact) => ({ ...contact }));
  const companyLinkedIn = directory?.companyLinkedInUrl?.trim() || null;

  const directoryName = [directory?.firstName, directory?.lastName]
    .filter((part) => !blank(part))
    .join(" ")
    .trim();

  if (directory && directoryName) {
    // The directory's personal LinkedIn, but only if it plausibly belongs to
    // this person — Cosafe's record pairs "Jonas Strandell" with
    // /in/joakim-genetay-…, which would send his icon to someone else.
    const ownLinkedInUrl = linkedInBelongsTo(directory.personLinkedInUrl, directory.firstName, directory.lastName)
      ? directory.personLinkedInUrl!.trim()
      : null;
    // Same person if the LinkedIn profile matches (names differ: the directory
    // has "Kasper Duncker", the sheet "Kasper Duncker Würtz"), else by name.
    const directoryLinkedIn = linkedInKey(ownLinkedInUrl);
    // Last resort: same first name AND same job title (the AB Studios sheet has
    // "Zoe Kurtz", the directory "Zoe Ballin", both Director of Sales and
    // Marketing) — only when exactly one sheet row qualifies.
    const directoryFirst = directory.firstName ? nameKey(directory.firstName) : "";
    const directoryTitle = directory.designation ? nameKey(directory.designation) : "";
    const byFirstNameAndTitle =
      directoryFirst && directoryTitle
        ? contacts.filter(
            (contact) =>
              nameKey(contact.fullName.split(/\s+/)[0] ?? "") === directoryFirst &&
              !!contact.jobTitle &&
              nameKey(contact.jobTitle) === directoryTitle
          )
        : [];
    const existing =
      (directoryLinkedIn &&
        contacts.find((contact) => linkedInKey(contact.personLinkedInUrl) === directoryLinkedIn)) ||
      contacts.find((contact) => nameKey(contact.fullName) === nameKey(directoryName)) ||
      (byFirstNameAndTitle.length === 1 ? byFirstNameAndTitle[0] : undefined);
    if (existing) {
      if (blank(existing.email)) existing.email = directory.email?.trim() || null;
      if (blank(existing.mobile)) existing.mobile = directory.phone?.trim() || null;
      if (blank(existing.personLinkedInUrl)) existing.personLinkedInUrl = ownLinkedInUrl;
    } else {
      contacts.push({
        fullName: directoryName,
        company: directory.companyName,
        jobTitle: directory.designation?.trim() || null,
        email: directory.email?.trim() || null,
        mobile: directory.phone?.trim() || null,
        country: directory.country?.trim() || null,
        personLinkedInUrl: ownLinkedInUrl,
        companyLinkedInUrl: null,
      });
    }
  }

  if (companyLinkedIn) {
    for (const contact of contacts) {
      if (blank(contact.companyLinkedInUrl)) contact.companyLinkedInUrl = companyLinkedIn;
    }
  }

  const mobileOverride = MOBILE_OVERRIDES[domain.toLowerCase()];
  if (mobileOverride) {
    for (const contact of contacts) contact.mobile = mobileOverride;
  }

  const companyOverride = COMPANY_NAME_OVERRIDES[domain.toLowerCase()];
  if (companyOverride) {
    for (const contact of contacts) contact.company = companyOverride;
  }

  if (PAPER_PLANE_MAILTO.has(domain.toLowerCase())) {
    for (const contact of contacts) {
      if (blank(contact.messagingUrl) && !blank(contact.email)) {
        contact.messagingUrl = `mailto:${contact.email!.trim()}`;
      }
    }
  }

  return contacts;
}
