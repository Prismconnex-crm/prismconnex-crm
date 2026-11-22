import { describe, expect, it } from "vitest";
import {
  alwaysShowContactIcons,
  getCompanyContacts,
  type DirectoryContact,
} from "@/lib/companies/company-contacts";

// The BETT directory's record for ACEBOTT, as stored on EventExhibitor.
const acebottDirectory: DirectoryContact = {
  companyName: "ACEBOTT Co., Ltd.",
  firstName: "Wade",
  lastName: "Chen",
  designation: "Sales Manager",
  email: "wade@acebott.com",
  phone: "86 13378429333",
  country: "China",
  personLinkedInUrl: "https://www.linkedin.com/in/wade-chen-251213217/",
  companyLinkedInUrl: "https://www.linkedin.com/company/acebott",
};

describe("company contacts", () => {
  it("returns every ACEBOTT spreadsheet record with no duplicates", () => {
    const contacts = getCompanyContacts("acebott.com", acebottDirectory)!;
    expect(contacts).toHaveLength(18);
    const names = contacts.map((c) => c.fullName);
    expect(new Set(names).size).toBe(18);
    expect(names[0]).toBe("Safiya Banu Kaja Mohaideen");
    expect(names[17]).toBe("Chicheng He");
  });

  it("keeps sheet values exactly, decoding non-Latin job titles", () => {
    const contacts = getCompanyContacts("acebott.com")!;
    const anthony = contacts.find((c) => c.fullName === "Anthony Wang")!;
    expect(anthony.jobTitle).toBe("销售经理");
    expect(anthony.country).toBe("China");
    expect(contacts.find((c) => c.fullName === "Lucille Zhou")!.jobTitle).toBe("sales manger");
    expect(contacts.find((c) => c.fullName === "Safiya Banu Kaja Mohaideen")!.country).toBe("Saudi Arabia");
  });

  it("turns export placeholders into empty values rather than fake data", () => {
    const contacts = getCompanyContacts("acebott.com")!;
    for (const c of contacts) {
      expect(c.email).toBeNull();
      expect(c.personLinkedInUrl).toBeNull();
    }
  });

  it("shows mobile 86 133 7842 9333 on every ACEBOTT contact and nowhere else", () => {
    const contacts = getCompanyContacts("acebott.com", acebottDirectory)!;
    expect(contacts).toHaveLength(18);
    expect(contacts.every((c) => c.mobile === "86 133 7842 9333")).toBe(true);
    for (const domain of ["acer.com", "activefloor.com", "actionmats.co.uk"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "86 133 7842 9333")).toBe(false);
    }
  });

  it("folds the directory contact into the matching sheet row without overwriting it", () => {
    const contacts = getCompanyContacts("acebott.com", acebottDirectory)!;
    const wade = contacts.filter((c) => c.fullName === "Wade Chen");
    expect(wade).toHaveLength(1);
    expect(wade[0].jobTitle).toBe("Foreign Trade Manager");
    expect(wade[0].email).toBe("wade@acebott.com");
    expect(wade[0].mobile).toBe("86 133 7842 9333");
    expect(wade[0].personLinkedInUrl).toBe("https://www.linkedin.com/in/wade-chen-251213217/");
  });

  it("applies the company LinkedIn to every row", () => {
    const contacts = getCompanyContacts("acebott.com", acebottDirectory)!;
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/acebott")).toBe(true);
  });

  it("returns every Acer CSV record with its own personal LinkedIn URL", () => {
    const contacts = getCompanyContacts("acer.com")!;
    expect(contacts).toHaveLength(25);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(25);
    const linkedIns = contacts.map((c) => c.personLinkedInUrl);
    expect(linkedIns.every((url) => url?.startsWith("https://www.linkedin.com/in/"))).toBe(true);
    expect(new Set(linkedIns).size).toBe(25);
    expect(linkedIns).not.toContain("https://www.linkedin.com/company/acer");
    expect(contacts.find((c) => c.fullName === "Theresa Coronel Fuchs")).toMatchObject({
      personLinkedInUrl: "https://www.linkedin.com/in/tcfuchs",
      companyLinkedInUrl: "https://www.linkedin.com/company/acer",
      jobTitle: "Marketing Communications Manager",
      email: "theresa.fuchs@acer.com",
      mobile: null,
      country: "United States",
    });
    expect(contacts.find((c) => c.fullName === "Nikola Bakula")!.email).toBeNull();
  });

  it("keeps the Acer directory contact when the CSV does not list them", () => {
    const contacts = getCompanyContacts("acer.com", {
      companyName: "Acer",
      firstName: "Valerie",
      lastName: "PIAU",
      designation: null,
      email: "valerie.freard-piau@acer.com",
      phone: null,
      country: null,
      personLinkedInUrl: "https://ch.linkedin.com/in/valerie-piau-67376a39",
      companyLinkedInUrl: "https://www.linkedin.com/company/acer/",
    })!;
    expect(contacts).toHaveLength(26);
    expect(contacts[25]).toMatchObject({
      fullName: "Valerie PIAU",
      personLinkedInUrl: "https://ch.linkedin.com/in/valerie-piau-67376a39",
    });
    // CSV rows keep their own company LinkedIn rather than the directory's.
    expect(contacts[0].companyLinkedInUrl).toBe("https://www.linkedin.com/company/acer");
  });

  it("shows the Action Mats directory contact in the table until a real export is imported", () => {
    const contacts = getCompanyContacts("actionmats.co.uk", {
      companyName: "Action Mats Limited",
      firstName: "Jonathan",
      lastName: "Bhowmick",
      designation: "Managing Director",
      email: "jonathan@actionmats.co.uk",
      phone: "44 1462 816 907",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/jonathan-bhowmick-82203416a/",
      companyLinkedInUrl: "https://www.linkedin.com/company/action-mats-limited/?originalSubdomain=uk",
    })!;
    expect(contacts).toEqual([
      {
        fullName: "Jonathan Bhowmick",
        company: "Action Mats Limited",
        jobTitle: "Managing Director",
        email: "jonathan@actionmats.co.uk",
        mobile: "44 1462 816 907",
        country: "United Kingdom",
        personLinkedInUrl: "https://www.linkedin.com/in/jonathan-bhowmick-82203416a/",
        companyLinkedInUrl: "https://www.linkedin.com/company/action-mats-limited/?originalSubdomain=uk",
      },
    ]);
    // No Acer staff leak into Action Mats.
    expect(contacts.some((c) => c.email?.endsWith("@acer.com"))).toBe(false);
  });

  const activeFloorDirectory: DirectoryContact = {
    companyName: "ActiveFloor",
    firstName: "Kasper",
    lastName: "Duncker",
    designation: "COO",
    email: "duncker@activefloor.com",
    phone: "45 31 700 729",
    country: "Denmark",
    personLinkedInUrl: "https://www.linkedin.com/in/kasper-duncker-w%C3%BCrtz-24563670/",
    companyLinkedInUrl: "https://www.linkedin.com/company/activefloorglobal/",
  };

  it("returns every ActiveFloor CSV record with individual LinkedIn URLs", () => {
    const contacts = getCompanyContacts("activefloor.com", activeFloorDirectory)!;
    expect(contacts).toHaveLength(25);
    const linkedIns = contacts.map((c) => c.personLinkedInUrl);
    expect(linkedIns.every((url) => url?.startsWith("https://www.linkedin.com/in/"))).toBe(true);
    expect(new Set(linkedIns).size).toBe(25);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/activefloorglobal")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Julia Lindsay Correll Emborg")).toMatchObject({
      personLinkedInUrl: "https://www.linkedin.com/in/juliaemborg",
      jobTitle: "Marketingspecialist",
      email: "je@activefloor.com",
      mobile: "45 30 70 07 29",
      country: "Denmark",
    });
    // Two distinct LinkedIn profiles under the same name and email are both kept.
    expect(contacts.filter((c) => c.fullName === "Alan Mcdonald")).toHaveLength(2);
  });

  it("matches the ActiveFloor directory contact by LinkedIn profile despite a different name", () => {
    const contacts = getCompanyContacts("activefloor.com", activeFloorDirectory)!;
    expect(contacts.some((c) => c.fullName === "Kasper Duncker")).toBe(false);
    expect(contacts.find((c) => c.fullName === "Kasper Duncker Würtz")).toMatchObject({
      jobTitle: "Chief Operating Officer",
      email: "kd@activefloor.com",
      mobile: "45 30 70 07 29",
      personLinkedInUrl: "https://www.linkedin.com/in/kasper-duncker-würtz-24563670",
    });
  });

  it("shows mobile 45 30 70 07 29 on every ActiveFloor contact and nowhere else", () => {
    const activeFloor = getCompanyContacts("activefloor.com", activeFloorDirectory)!;
    expect(activeFloor).toHaveLength(25);
    expect(activeFloor.every((c) => c.mobile === "45 30 70 07 29")).toBe(true);
    for (const domain of ["acer.com", "acebott.com", "actionmats.co.uk"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "45 30 70 07 29")).toBe(false);
    }
  });

  it("imports both Ag Lockdown contacts, folds in the directory contact, and applies its mobile", () => {
    const contacts = getCompanyContacts("aglockdown.com", {
      companyName: "Ag Lockdown",
      firstName: "Tony",
      lastName: "Foote",
      designation: "Managing Director",
      email: "tony.foote@aglockdown.com",
      phone: "44 203 518 7212",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/tony-foote-184406b/",
      companyLinkedInUrl: "https://www.linkedin.com/company/aglockdown/",
    })!;
    expect(contacts).toEqual([
      {
        fullName: "Tony Foote",
        company: "Ag Lockdown",
        jobTitle: "Managing Director",
        email: "tony.foote@aglockdown.com",
        mobile: "44 203 518 7212",
        country: "United Kingdom",
        personLinkedInUrl: "https://www.linkedin.com/in/tony-foote-184406b",
        companyLinkedInUrl: "https://www.linkedin.com/company/aglockdown",
      },
      {
        fullName: "Tim Sagar",
        company: "Ag Lockdown",
        jobTitle: "Non Executive Director",
        email: "tim.sagar@aglockdown.com",
        mobile: "44 203 518 7212",
        country: "United States",
        personLinkedInUrl: "https://www.linkedin.com/in/timsagar",
        companyLinkedInUrl: "https://www.linkedin.com/company/aglockdown",
      },
    ]);
    for (const domain of ["acer.com", "acebott.com", "activefloor.com", "actionmats.co.uk"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "44 203 518 7212")).toBe(false);
    }
  });

  it("finds AITutoring.me by company name when the exhibitor has no website", () => {
    const contacts = getCompanyContacts(null, {
      companyName: "AITutoring.me",
      firstName: null,
      lastName: null,
      designation: null,
      email: null,
      phone: null,
      country: null,
      personLinkedInUrl: null,
      companyLinkedInUrl: null,
    })!;
    expect(contacts).toEqual([
      {
        fullName: "Stephen Kinsey",
        company: "AITutoring.me",
        jobTitle: "Chief Technology Officer",
        email: null,
        mobile: null,
        country: "United Kingdom",
        personLinkedInUrl: null,
        companyLinkedInUrl: null,
      },
    ]);
  });

  it("does not use the name fallback for an unrelated company without a website", () => {
    expect(
      getCompanyContacts(null, {
        companyName: "Tracer Products",
        firstName: null,
        lastName: null,
        designation: null,
        email: null,
        phone: null,
        country: null,
        personLinkedInUrl: null,
        companyLinkedInUrl: null,
      })
    ).toBeNull();
  });

  it("imports all 9 AB Studios contacts and folds the directory's Zoe Ballin into Zoe Kurtz", () => {
    const contacts = getCompanyContacts("abstudios.com", {
      companyName: "AB Studios",
      firstName: "Zoe",
      lastName: "Ballin",
      designation: "Director of Sales and Marketing",
      email: "zoe@abstudios.com",
      phone: null,
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/zoe-kurtz/",
      companyLinkedInUrl: "https://www.linkedin.com/company/abstudioseducation/",
    })!;
    expect(contacts).toHaveLength(9);
    expect(contacts.some((c) => c.fullName === "Zoe Ballin")).toBe(false);
    expect(contacts[0]).toEqual({
      fullName: "Zoe Kurtz",
      company: "Studios",
      jobTitle: "Director of Sales and Marketing",
      email: "zoe@abstudios.com",
      mobile: null,
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/zoe-kurtz/",
      companyLinkedInUrl: "https://www.linkedin.com/company/abstudioseducation/",
    });
    for (const c of contacts.slice(1)) {
      expect(c.personLinkedInUrl).toBeNull();
      expect(c.email).toBeNull();
      expect(c.mobile).toBeNull();
      expect(c.companyLinkedInUrl).toBe("https://www.linkedin.com/company/abstudioseducation/");
    }
  });

  it("always shows both contact icons for ACEBOTT and AB Studios only", () => {
    expect(alwaysShowContactIcons("acebott.com")).toBe(true);
    expect(alwaysShowContactIcons("abstudios.com")).toBe(true);
    expect(alwaysShowContactIcons("4matrixcloud.com")).toBe(true);
    for (const domain of ["acer.com", "activefloor.com", "aglockdown.com", "actionmats.co.uk"]) {
      expect(alwaysShowContactIcons(domain)).toBe(false);
    }
    // No website on the BETT record — resolved by name, and opted in.
    expect(alwaysShowContactIcons(null, "AITutoring.me")).toBe(true);
    expect(alwaysShowContactIcons(null, "Tracer Products")).toBe(false);
    expect(alwaysShowContactIcons(null)).toBe(false);
  });

  it("imports all 6 4Matrix contacts with individual LinkedIn URLs and folds in the directory contact", () => {
    const contacts = getCompanyContacts("4matrixcloud.com", {
      companyName: "4Matrix",
      firstName: "Chris",
      lastName: "Smith",
      designation: "Development Manager",
      email: "chris@4matrix.com",
      phone: "44 20 3475 4463",
      country: "United Kingdom",
      personLinkedInUrl: "https://uk.linkedin.com/in/cjsmith87",
      companyLinkedInUrl: "https://www.linkedin.com/company/4matrix",
    })!;
    expect(contacts.map((c) => c.fullName)).toEqual([
      "Indrani Gajjarapu",
      "Hassan Yaqoob",
      "Joel Spencer",
      "Chris Smith",
      "Godwin Ngaju",
      "Julie Tanner",
    ]);
    expect(new Set(contacts.map((c) => c.personLinkedInUrl)).size).toBe(6);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/4matrix")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Chris Smith")).toMatchObject({
      personLinkedInUrl: "https://www.linkedin.com/in/cjsmith87",
      email: "chris@4matrix.com",
    });
    expect(contacts.find((c) => c.fullName === "Hassan Yaqoob")!.country).toBe("Malaysia");
    // 2026-11-22: owner's number on every 4Matrix row.
    expect(contacts.every((c) => c.mobile === "44 203 475 4463")).toBe(true);
  });

  it("imports all 16 Airia contacts with the mobile override, folding in the directory contact", () => {
    const contacts = getCompanyContacts("airia.com", {
      companyName: "Airia",
      firstName: "Julia",
      lastName: "Harold",
      designation: "Product Marketing",
      email: "juliaharold@airia.com",
      phone: "1 914 220 2699",
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/juliaharold/",
      companyLinkedInUrl: "https://www.linkedin.com/company/airia-enterprise-ai/",
    })!;
    expect(contacts).toHaveLength(16);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(16);
    expect(contacts.every((c) => c.mobile === "1 914 220 2699")).toBe(true);
    expect(contacts.every((c) => c.company === "Airia")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/airia-enterprise-ai/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Julia Harold")).toMatchObject({
      email: "juliaharold@airia.com",
      personLinkedInUrl: "https://www.linkedin.com/in/juliaharold/",
    });
    expect(contacts[0].jobTitle).toBe("Sales Lead | GTM Education");
    expect(contacts.find((c) => c.fullName === "Kristian Malamov")!.country).toBe("Bulgaria");
    expect(alwaysShowContactIcons("airia.com")).toBe(true);
    for (const domain of ["acer.com", "acebott.com", "activefloor.com", "aglockdown.com", "4matrixcloud.com"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "1 914 220 2699")).toBe(false);
    }
  });

  it("imports all 25 Albion contacts with mobile and company-name overrides", () => {
    const contacts = getCompanyContacts("albion.co.uk", {
      companyName: "Albion Computers Plc",
      firstName: "Will",
      lastName: "Mayes",
      designation: "Head Of Marketing",
      email: "w.mayes@albion.co.uk",
      phone: "44 333 006 6025",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/will-mayes-25b90016b",
      companyLinkedInUrl: "https://www.linkedin.com/company/albion-computers-plc/",
    })!;
    expect(contacts).toHaveLength(25);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(25);
    expect(contacts.every((c) => c.mobile === "44 333 006 6025")).toBe(true);
    expect(contacts.every((c) => c.company === "Albion Computers Plc")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/albion-computers-plc/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Will Mayes")).toMatchObject({
      email: "w.mayes@albion.co.uk",
      personLinkedInUrl: "https://www.linkedin.com/in/will-mayes-25b90016b",
      jobTitle: "Head Of Marketing",
    });
    expect(contacts.find((c) => c.fullName === "Marko Tomic")!.country).toBe("United States");
    // "Reveal email" / "No email" placeholders are empty, not fake values.
    expect(contacts.find((c) => c.fullName === "Howard Cole")!.email).toBeNull();
    expect(alwaysShowContactIcons("albion.co.uk")).toBe(true);
    // Overrides stay with Albion.
    for (const domain of ["acer.com", "airia.com", "4matrixcloud.com"]) {
      const others = getCompanyContacts(domain)!;
      expect(others.some((c) => c.mobile === "44 333 006 6025" || c.company === "Albion Computers Plc")).toBe(false);
    }
  });

  it("imports all 16 ANTON contacts and keeps the directory contact who is not in the sheet", () => {
    const contacts = getCompanyContacts("anton.app", {
      companyName: "ANTON",
      firstName: "Alexa",
      lastName: "Banker-Busch",
      designation: "Growth Manager",
      email: "alexa@anton.app",
      phone: null,
      country: "Germany",
      personLinkedInUrl: "https://www.linkedin.com/in/alexa-banker-busch-0b6bb9246/",
      companyLinkedInUrl: "https://www.linkedin.com/company/anton.app/",
    })!;
    expect(contacts).toHaveLength(17);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(17);
    expect(contacts.slice(0, 16).every((c) => c.company === "ANTON" && c.mobile === null)).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/anton.app/")).toBe(true);
    expect(contacts.map((c) => c.fullName)).toContain("Nhân Trương");
    expect(contacts.map((c) => c.fullName)).toContain("Felix Breßler");
    expect(contacts[16]).toMatchObject({
      fullName: "Alexa Banker-Busch",
      email: "alexa@anton.app",
      personLinkedInUrl: "https://www.linkedin.com/in/alexa-banker-busch-0b6bb9246/",
    });
    expect(alwaysShowContactIcons("anton.app")).toBe(true);
  });

  it("imports all 9 AQA contacts, keeps the directory contact, and applies the mobile to every row", () => {
    const contacts = getCompanyContacts("aqa.org.uk", {
      companyName: "AQA",
      firstName: "Rob",
      lastName: "Atkins",
      designation: "Marketing Manager",
      email: "ratkins@aqa.org.uk",
      phone: "44 161 696 5995",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/robatkins1982",
      companyLinkedInUrl: "https://www.linkedin.com/company/aqa",
    })!;
    expect(contacts).toHaveLength(10);
    expect(contacts.slice(0, 9).map((c) => c.fullName)).toEqual([
      "Oliver Drapper",
      "Mark Chester",
      "Kevin Yet Fong Cheung",
      "Jonny Mills",
      "Robin Kelly",
      "Kate Wilson",
      "Stuart Ogden",
      "Simon Collins",
      "Rachel Buckle",
    ]);
    expect(contacts.every((c) => c.mobile === "44 161 696 5995")).toBe(true);
    expect(contacts.every((c) => c.company === "AQA")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/aqa")).toBe(true);
    expect(contacts[9]).toMatchObject({
      fullName: "Rob Atkins",
      email: "ratkins@aqa.org.uk",
      personLinkedInUrl: "https://www.linkedin.com/in/robatkins1982",
    });
    expect(alwaysShowContactIcons("aqa.org.uk")).toBe(true);
    for (const domain of ["acer.com", "albion.co.uk", "4matrixcloud.com"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "44 161 696 5995")).toBe(false);
    }
  });

  it("imports all 25 Aresline contacts with mobile and company-name overrides", () => {
    const contacts = getCompanyContacts("aresline.com", {
      companyName: "Aresline",
      firstName: "Nicola",
      lastName: "Franceschi",
      designation: "Managing Director",
      email: "nicola.franceschi@aresline.com",
      phone: "39 0445 314931",
      country: "Italy",
      personLinkedInUrl: "https://www.linkedin.com/in/nicola-franceschi-aresline",
      companyLinkedInUrl: "https://www.linkedin.com/company/aresline/",
    })!;
    expect(contacts).toHaveLength(26);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(26);
    expect(contacts.every((c) => c.mobile === "39 0445 314931")).toBe(true);
    expect(contacts.every((c) => c.company === "Aresline")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/aresline/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Lanfranco Fossà")!.jobTitle).toBe("Export Area Manager A-DE-SK-CZ-HU-PL");
    expect(contacts.find((c) => c.fullName === "Sabrina Yu")!.country).toBe("Philippines");
    expect(contacts[25]).toMatchObject({
      fullName: "Nicola Franceschi",
      email: "nicola.franceschi@aresline.com",
      personLinkedInUrl: "https://www.linkedin.com/in/nicola-franceschi-aresline",
    });
    expect(alwaysShowContactIcons("aresline.com")).toBe(true);
    for (const domain of ["acer.com", "aqa.org.uk", "4matrixcloud.com"]) {
      const others = getCompanyContacts(domain)!;
      expect(others.some((c) => c.mobile === "39 0445 314931" || c.company === "Aresline")).toBe(false);
    }
  });

  it("imports all 8 AspiraCloud contacts with the mobile stored in the data and served on every row", async () => {
    const stored = (await import("@/data/company-contacts/aspiracloud.com.json")).default;
    expect(stored.contacts).toHaveLength(8);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 24 7697 0550")).toBe(true);

    const contacts = getCompanyContacts("aspiracloud.com", {
      companyName: "AspiraCloud",
      firstName: "Adrian",
      lastName: "Edgar",
      designation: "CEO",
      email: "adrian@aspiracloud.com",
      phone: "44 24 7697 0550",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/adrianedgar/",
      companyLinkedInUrl: "https://www.linkedin.com/company/aspiracloud-ltd/",
    })!;
    expect(contacts).toHaveLength(8);
    expect(contacts.every((c) => c.mobile === "44 24 7697 0550")).toBe(true);
    expect(contacts.every((c) => c.company === "AspiraCloud")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/aspiracloud-ltd/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Adrian Edgar")).toMatchObject({
      jobTitle: "Chief Executive Officer",
      email: "adrian@aspiracloud.com",
      personLinkedInUrl: "https://www.linkedin.com/in/adrianedgar/",
    });
    expect(alwaysShowContactIcons("aspiracloud.com")).toBe(true);
    for (const domain of ["acer.com", "aresline.com", "4matrixcloud.com"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "44 24 7697 0550")).toBe(false);
    }
  });

  it("imports all 25 Audiebant contacts with the mobile stored in the data and served on every row", async () => {
    const stored = (await import("@/data/company-contacts/audiebant.co.uk.json")).default;
    expect(stored.contacts).toHaveLength(25);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 3331 882 324")).toBe(true);

    const contacts = getCompanyContacts("audiebant.co.uk", {
      companyName: "Audiebant",
      firstName: "Gary",
      lastName: "Dean",
      designation: "Founder Director",
      email: "gary.dean@audiebant.co.uk",
      phone: "44 3331 882 324",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/gary-dean-a6126a34",
      companyLinkedInUrl: "https://www.linkedin.com/company/audiebant/",
    })!;
    expect(contacts).toHaveLength(25);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(25);
    expect(contacts.every((c) => c.mobile === "44 3331 882 324")).toBe(true);
    expect(contacts.every((c) => c.company === "Audiebant")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/audiebant/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Gary Dean")).toMatchObject({
      jobTitle: "Founder",
      email: "gary.dean@audiebant.co.uk",
      personLinkedInUrl: "https://www.linkedin.com/in/gary-dean-a6126a34",
    });
    expect(contacts.find((c) => c.fullName === "David Litvinov")!.country).toBe("United States");
    expect(alwaysShowContactIcons("audiebant.co.uk")).toBe(true);
    for (const domain of ["acer.com", "aspiracloud.com", "4matrixcloud.com"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "44 3331 882 324")).toBe(false);
    }
  });

  it("imports all 25 Avocor contacts with the mobile stored in the data and served on every row", async () => {
    const stored = (await import("@/data/company-contacts/avocor.com.json")).default;
    expect(stored.contacts).toHaveLength(25);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 333 300 3457")).toBe(true);

    const contacts = getCompanyContacts("avocor.com", {
      companyName: "Avocor",
      firstName: "Patrick",
      lastName: "Graff",
      designation: "Global Channel Partner Lead",
      email: "patrick.graff@avocor.com",
      phone: "44 333 300 3457",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/patrick-graff/",
      companyLinkedInUrl: "https://www.linkedin.com/company/avocor/",
    })!;
    expect(contacts).toHaveLength(25);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(25);
    expect(contacts.every((c) => c.mobile === "44 333 300 3457")).toBe(true);
    expect(contacts.every((c) => c.company === "Avocor")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/avocor/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Patrick Graff")).toMatchObject({
      email: "patrick.graff@avocor.com",
      personLinkedInUrl: "https://www.linkedin.com/in/patrick-graff/",
    });
    expect(contacts.find((c) => c.fullName === "Anders Simonsen")!.country).toBe("Norway");
    expect(alwaysShowContactIcons("avocor.com")).toBe(true);
    for (const domain of ["acer.com", "audiebant.co.uk", "4matrixcloud.com"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "44 333 300 3457")).toBe(false);
    }
  });

  it("imports all 11 BenMaker contacts with stored mobile and the full company name", async () => {
    const stored = (await import("@/data/company-contacts/benmaker.com.json")).default;
    expect(stored.contacts).toHaveLength(11);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "90 224 504 15 97")).toBe(true);

    const contacts = getCompanyContacts("benmaker.com", {
      companyName: "BenMaker Early Age Education Equipment Industry Trade and Services Inc.",
      firstName: "Sait",
      lastName: "Korkmaztürk",
      designation: "Chief of production",
      email: "sait.korkmazturrk@benmaker.com",
      phone: "90 224 504 15 97",
      country: "Türkiye",
      personLinkedInUrl: "https://www.linkedin.com/in/sait-korkmazt%C3%BCrk-198b797b/",
      companyLinkedInUrl: "https://www.linkedin.com/company/benmaker/",
    })!;
    expect(contacts).toHaveLength(11);
    expect(contacts.every((c) => c.mobile === "90 224 504 15 97")).toBe(true);
    expect(
      contacts.every((c) => c.company === "BenMaker Early Age Education Equipment Industry Trade and Services Inc")
    ).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/benmaker/")).toBe(true);
    expect(contacts[0]).toMatchObject({
      fullName: "Sait Korkmaztürk",
      jobTitle: "Üretim Sefi",
      email: "sait.korkmazturrk@benmaker.com",
      personLinkedInUrl: "https://www.linkedin.com/in/sait-korkmazt%C3%BCrk-198b797b/",
      country: "Turkey",
    });
    // Two spellings, two rows — kept as the sheet has them.
    expect(contacts.filter((c) => /^Y[uü]ksel [CÇ]etin$/.test(c.fullName))).toHaveLength(2);
    expect(alwaysShowContactIcons("benmaker.com")).toBe(true);
    for (const domain of ["acer.com", "avocor.com", "4matrixcloud.com"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "90 224 504 15 97")).toBe(false);
    }
  });

  it("imports all 25 Blocksi contacts with stored mobile and company name Blocksi", async () => {
    const stored = (await import("@/data/company-contacts/blocksi.net.json")).default;
    expect(stored.contacts).toHaveLength(25);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "1 877 693 4822")).toBe(true);

    const contacts = getCompanyContacts("blocksi.net", {
      companyName: "Blocksi",
      firstName: "Paul",
      lastName: "Schiltgen",
      designation: "VP of Sales",
      email: "paschiltgen@blocksi.net",
      phone: "1 877 693 4822",
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/paulschiltgen/",
      companyLinkedInUrl: "https://www.linkedin.com/company/blocksi/",
    })!;
    expect(contacts).toHaveLength(25);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(25);
    expect(contacts[0]).toMatchObject({ fullName: "Jonathan Powell", jobTitle: "Customer Success Manager", country: "United States" });
    expect(contacts[24]).toMatchObject({ fullName: "Dmytro Chyzhovych", jobTitle: "Software Developer", country: "Finland" });
    expect(contacts.every((c) => c.mobile === "1 877 693 4822")).toBe(true);
    expect(contacts.every((c) => c.company === "Blocksi")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/blocksi/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Paul Schiltgen")).toMatchObject({
      email: "paschiltgen@blocksi.net",
      personLinkedInUrl: "https://www.linkedin.com/in/paulschiltgen/",
    });
    // "Reveal email" / "No email" placeholders never become values.
    expect(contacts.filter((c) => c.email).map((c) => c.fullName)).toEqual(["Paul Schiltgen"]);
    expect(alwaysShowContactIcons("blocksi.net")).toBe(true);
    for (const domain of ["acer.com", "benmaker.com", "4matrixcloud.com"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "1 877 693 4822")).toBe(false);
    }
  });

  it("imports the 22 Brisk Teaching contacts, excludes Blocksi rows, and wires the paper-plane to email", () => {
    const contacts = getCompanyContacts("briskteaching.com", {
      companyName: "Brisk Teaching",
      firstName: "Jessica",
      lastName: "Bershad",
      designation: "Social and Brand Marketing Lead",
      email: "jessica@briskteaching.com",
      phone: null,
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/jessicabershad/",
      companyLinkedInUrl: "https://www.linkedin.com/company/brisk-teaching/",
    })!;
    expect(contacts).toHaveLength(23);
    const names = contacts.map((c) => c.fullName);
    expect(new Set(names).size).toBe(23);
    for (const blocksiPerson of ["Jonathan Powell", "Amanda Lyles", "Jack Byrne"]) {
      expect(names).not.toContain(blocksiPerson);
    }
    expect(contacts.every((c) => c.company === "Brisk Teaching")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/brisk-teaching/")).toBe(true);
    // "Available (Reveal)" status columns are not emails or numbers.
    expect(contacts.slice(0, 22).every((c) => c.email === null && c.mobile === null && !c.messagingUrl)).toBe(true);
    expect(contacts[22]).toMatchObject({
      fullName: "Jessica Bershad",
      email: "jessica@briskteaching.com",
      messagingUrl: "mailto:jessica@briskteaching.com",
      personLinkedInUrl: "https://www.linkedin.com/in/jessicabershad/",
    });
    expect(alwaysShowContactIcons("briskteaching.com")).toBe(true);
    // The mailto paper-plane is Brisk-only.
    expect(getCompanyContacts("4matrixcloud.com")!.some((c) => c.messagingUrl)).toBe(false);
  });

  it("imports all 25 Bromcom contacts with stored mobile and keeps the directory contact", async () => {
    const stored = (await import("@/data/company-contacts/bromcom.com.json")).default;
    expect(stored.contacts).toHaveLength(25);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "+44 20 8290 7100")).toBe(true);

    const contacts = getCompanyContacts("bromcom.com", {
      companyName: "Bromcom",
      firstName: "Mem",
      lastName: "Kutlay",
      designation: "Marketing Events Executive",
      email: "mem.kutlay@bromcom.com",
      phone: "44 20 8290 7100",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/mem-kutlay-560477263/",
      companyLinkedInUrl: "https://www.linkedin.com/company/bromcom/",
    })!;
    expect(contacts).toHaveLength(26);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(26);
    expect(contacts.every((c) => c.mobile === "+44 20 8290 7100")).toBe(true);
    expect(contacts.every((c) => c.company === "Bromcom")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/bromcom/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Mehmet Ali Önde")!.country).toBe("Turkey");
    expect(contacts[25]).toMatchObject({
      fullName: "Mem Kutlay",
      email: "mem.kutlay@bromcom.com",
      personLinkedInUrl: "https://www.linkedin.com/in/mem-kutlay-560477263/",
    });
    expect(alwaysShowContactIcons("bromcom.com")).toBe(true);
    for (const domain of ["acer.com", "blocksi.net", "4matrixcloud.com"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "+44 20 8290 7100")).toBe(false);
    }
  });

  it("imports all 16 CardExchange contacts in sheet order with the stored mobile", async () => {
    const stored = (await import("@/data/company-contacts/cardexchangeid.com.json")).default;
    expect(stored.contacts).toHaveLength(16);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "+1 925-529-4999")).toBe(true);

    const contacts = getCompanyContacts("cardexchangeid.com", {
      companyName: "CardExchange Solutions, LLC",
      firstName: "Marcel",
      lastName: "Oosterhof",
      designation: "President",
      email: "marcel@cardexchangeid.com",
      phone: "1 925-529-4999",
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/marcel-oosterhof-6958a97/",
      companyLinkedInUrl: "https://www.linkedin.com/company/cardexchange-solutions/",
    })!;
    expect(contacts).toHaveLength(16);
    expect(contacts[0].fullName).toBe("Elliot Davis");
    expect(contacts[15].fullName).toBe("Emma Claire");
    expect(contacts.every((c) => c.mobile === "+1 925-529-4999")).toBe(true);
    expect(contacts.every((c) => c.company === "CardExchange Solutions")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/cardexchange-solutions/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Marcel Oosterhof")).toMatchObject({
      email: "marcel@cardexchangeid.com",
      personLinkedInUrl: "https://www.linkedin.com/in/marcel-oosterhof-6958a97/",
    });
    expect(alwaysShowContactIcons("cardexchangeid.com")).toBe(true);
    for (const domain of ["acer.com", "bromcom.com", "4matrixcloud.com"]) {
      expect(getCompanyContacts(domain)!.some((c) => c.mobile === "+1 925-529-4999")).toBe(false);
    }
  });

  it("imports all 50 Carolina Science contacts with the owner's mobile and keeps the directory contact", async () => {
    const stored = (await import("@/data/company-contacts/carolina.com.json")).default;
    expect(stored.contacts).toHaveLength(50);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "1 800-334-551")).toBe(true);

    const contacts = getCompanyContacts("carolina.com", {
      companyName: "Carolina Science",
      firstName: "Leigh-Anna",
      lastName: "Ballard",
      designation: "Sr Marketing Manager",
      email: "leigh-anna.ballard@carolina.com",
      phone: "1 800-334-5551",
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/leigh-anna-ballard-14657753/",
      companyLinkedInUrl: "https://www.linkedin.com/company/carolina-science/",
    })!;
    expect(contacts).toHaveLength(51);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(51);
    expect(contacts[0].fullName).toBe("Shannon Mcgurk");
    expect(contacts[49].fullName).toBe("Desiree Wright");
    expect(contacts.every((c) => c.mobile === "1 800-334-551")).toBe(true);
    expect(contacts.every((c) => c.company === "Carolina Science")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/carolina-science/")).toBe(true);
    expect(contacts[50]).toMatchObject({
      fullName: "Leigh-Anna Ballard",
      email: "leigh-anna.ballard@carolina.com",
      personLinkedInUrl: "https://www.linkedin.com/in/leigh-anna-ballard-14657753/",
    });
    expect(alwaysShowContactIcons("carolina.com")).toBe(true);
  });

  it("imports all 13 Clarion contacts with stored mobile and keeps the directory contact", async () => {
    const stored = (await import("@/data/company-contacts/clarioncomms.com.json")).default;
    expect(stored.contacts).toHaveLength(13);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 333 222 6633")).toBe(true);

    const contacts = getCompanyContacts("clarioncomms.com", {
      companyName: "Clarion Communication Management Ltd",
      firstName: "Ben",
      lastName: "Bradbury",
      designation: "Founder",
      email: "bb@clarioncomms.com",
      phone: "44 333 222 6633",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/benebradbury/",
      companyLinkedInUrl: "https://www.linkedin.com/company/clarion-communication-management",
    })!;
    expect(contacts).toHaveLength(14);
    expect(contacts[0].fullName).toBe("John Burnett");
    expect(contacts[12].fullName).toBe("Charles Murray");
    expect(contacts.every((c) => c.mobile === "44 333 222 6633")).toBe(true);
    expect(contacts.slice(0, 13).every((c) => c.company === "Clarion Communication Management")).toBe(true);
    expect(
      contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/clarion-communication-management")
    ).toBe(true);
    expect(contacts[13]).toMatchObject({
      fullName: "Ben Bradbury",
      email: "bb@clarioncomms.com",
      personLinkedInUrl: "https://www.linkedin.com/in/benebradbury/",
    });
    expect(alwaysShowContactIcons("clarioncomms.com")).toBe(true);
  });

  it("imports all 100 ClassDojo contacts in order with no shared mobile", () => {
    const empty = {
      firstName: null,
      lastName: null,
      designation: null,
      email: null,
      phone: null,
      country: null,
      personLinkedInUrl: null,
      companyLinkedInUrl: null,
    };
    const contacts = getCompanyContacts("classdojo.com", { companyName: "ClassDojo", ...empty })!;
    expect(contacts).toHaveLength(100);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(100);
    expect(contacts[0]).toMatchObject({ fullName: "Ray Lyons", jobTitle: "Districts Product Leader", country: "United States" });
    expect(contacts[99].fullName).toBe("Adam Delaney");
    expect(contacts.every((c) => c.company === "ClassDojo")).toBe(true);
    // "Reveal email" / "Reveal mobile" status columns are not values, and no
    // common number is applied.
    expect(contacts.every((c) => c.email === null && c.mobile === null)).toBe(true);
    expect(contacts.find((c) => c.fullName === "Jakub Kaš")!.country).toBe("Czech Republic");
    expect(alwaysShowContactIcons("classdojo.com")).toBe(true);
  });

  it("imports all 100 Classera contacts with repaired text, both Elgamal rows, and the stored mobile", async () => {
    const stored = (await import("@/data/company-contacts/classera.com.json")).default;
    expect(stored.contacts).toHaveLength(100);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "1 414 687-5892")).toBe(true);

    const contacts = getCompanyContacts("classera.com", {
      companyName: "Classera Inc.",
      firstName: "Ahmad",
      lastName: "Farhan",
      designation: "Vice President of Product",
      email: "a.farhan@classera.com",
      phone: "1 414 687 - 5892",
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/ahmadifarhan",
      companyLinkedInUrl: "https://www.linkedin.com/company/classera-inc-/",
    })!;
    expect(contacts).toHaveLength(100);
    expect(contacts[0]).toMatchObject({
      fullName: "Ahmad Farhan",
      jobTitle: "VP of Product",
      email: "a.farhan@classera.com",
      personLinkedInUrl: "https://www.linkedin.com/in/ahmadifarhan",
    });
    expect(contacts[99].fullName).toBe("Shereef Metwally Mba And M.Sc");
    expect(contacts.every((c) => c.mobile === "1 414 687-5892")).toBe(true);
    expect(contacts.every((c) => c.company === "Classera")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/classera-inc-/")).toBe(true);
    // Mojibake from the source repaired, not carried through.
    expect(contacts.map((c) => c.fullName)).toContain("Sa' Shaheen سائد شاهين");
    expect(contacts.find((c) => c.fullName === "Mada Alghamdi")!.jobTitle).toBe(
      "Project Manager – EdTech Implementation & Strategic Activation"
    );
    expect(contacts.some((c) => /Ø|â€/.test(`${c.fullName} ${c.jobTitle}`))).toBe(false);
    // Two rows, different titles — both kept.
    expect(contacts.filter((c) => c.fullName === "Islam A. Elgamal").map((c) => c.jobTitle)).toEqual([
      "Business Development Manager",
      "Regional Business Development Manager",
    ]);
    expect(alwaysShowContactIcons("classera.com")).toBe(true);
  });

  it("imports all 100 ClassLink contacts in order with the stored mobile", async () => {
    const stored = (await import("@/data/company-contacts/classlink.com.json")).default;
    expect(stored.contacts).toHaveLength(100);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "1 888963-7550")).toBe(true);

    const contacts = getCompanyContacts("classlink.com", {
      companyName: "ClassLink Inc.",
      firstName: "Gregg",
      lastName: "Calvaruso",
      designation: "Senior Director of Marketing",
      email: "gcalvaruso@classlink.com",
      phone: "1 888 963-7550",
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/gregg-calvaruso/",
      companyLinkedInUrl: "https://www.linkedin.com/company/classlink/",
    })!;
    expect(contacts).toHaveLength(100);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(100);
    expect(contacts[0].fullName).toBe("Suman Minocha");
    expect(contacts[99].fullName).toBe("Joann Greenawalt");
    expect(contacts.every((c) => c.mobile === "1 888963-7550")).toBe(true);
    expect(contacts.every((c) => c.company === "ClassLink")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/classlink/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Gregg Calvaruso")).toMatchObject({
      jobTitle: "Vice President of Marketing",
      email: "gcalvaruso@classlink.com",
      personLinkedInUrl: "https://www.linkedin.com/in/gregg-calvaruso/",
    });
    expect(alwaysShowContactIcons("classlink.com")).toBe(true);
  });

  it("imports all 8 Classroomscreen contacts with no shared mobile, folding in the directory contact", () => {
    const contacts = getCompanyContacts("classroomscreen.com", {
      companyName: "Classroomscreen",
      firstName: "Laurens",
      lastName: "Koppers",
      designation: "Founder / CEO",
      email: "laurens@classroomscreen.com",
      phone: null,
      country: "Netherlands",
      personLinkedInUrl: "https://www.linkedin.com/in/laurens-koppers-37b112230/",
      companyLinkedInUrl: "https://www.linkedin.com/company/classroomscreen",
    })!;
    expect(contacts.map((c) => c.fullName)).toEqual([
      "Heleanne Rusthoven",
      "Sebastiaan De Vries",
      "Laurens Koppers",
      "Wouter De Wild",
      "Alice Whitting",
      "Sherilyn Caudle",
      "Michel Hulst",
      "Pavel Stoev",
    ]);
    expect(contacts.every((c) => c.mobile === null)).toBe(true);
    expect(contacts.every((c) => c.company === "Classroomscreen")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/classroomscreen")).toBe(true);
    expect(contacts[2]).toMatchObject({
      email: "laurens@classroomscreen.com",
      personLinkedInUrl: "https://www.linkedin.com/in/laurens-koppers-37b112230/",
    });
    expect(alwaysShowContactIcons("classroomscreen.com")).toBe(true);
  });

  it("imports all 100 Clever contacts in order with the owner's mobile", async () => {
    const stored = (await import("@/data/company-contacts/clever.com.json")).default;
    expect(stored.contacts).toHaveLength(100);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "1 877 578 5672")).toBe(true);

    const contacts = getCompanyContacts("clever.com", {
      companyName: "Clever Inc.",
      firstName: "Brea",
      lastName: "Mosley",
      designation: "Director of Brand Marketing",
      email: "brea.mosley@clever.com",
      phone: "1 877 578 5572",
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/breamosley/",
      companyLinkedInUrl: "https://www.linkedin.com/company/clever-inc-/",
    })!;
    expect(contacts).toHaveLength(100);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(100);
    expect(contacts[0].fullName).toBe("Darcy Grabski");
    expect(contacts[99].fullName).toBe("Quinn Fusting");
    expect(contacts.every((c) => c.mobile === "1 877 578 5672")).toBe(true);
    expect(contacts.every((c) => c.company === "Clever")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/clever-inc-/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Brea Mosley")).toMatchObject({
      jobTitle: "Director of Brand Marketing and Communications",
      email: "brea.mosley@clever.com",
      personLinkedInUrl: "https://www.linkedin.com/in/breamosley/",
    });
    expect(alwaysShowContactIcons("clever.com")).toBe(true);
  });

  it("imports all 18 Cloud Design Box contacts with stored mobile and keeps the directory contact", async () => {
    const stored = (await import("@/data/company-contacts/clouddesignbox.co.uk.json")).default;
    expect(stored.contacts).toHaveLength(18);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 1482 688890")).toBe(true);

    const contacts = getCompanyContacts("clouddesignbox.co.uk", {
      companyName: "Cloud Design Box Ltd",
      firstName: "Darren",
      lastName: "Hemming",
      designation: "Product Co-founder and Chief Strategy Officer",
      email: "darren.hemming@clouddesignbox.co.uk",
      phone: "44 1482 688890",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/darren-hemming-475ab217/",
      companyLinkedInUrl: "https://www.linkedin.com/company/clouddesignbox",
    })!;
    expect(contacts).toHaveLength(19);
    expect(contacts[0].fullName).toBe("Andrew Mulholland");
    expect(contacts[17].fullName).toBe("Lauren Ellis");
    expect(contacts.every((c) => c.mobile === "44 1482 688890")).toBe(true);
    expect(contacts.slice(0, 18).every((c) => c.company === "Cloud Design Box")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/clouddesignbox")).toBe(true);
    expect(contacts[18]).toMatchObject({
      fullName: "Darren Hemming",
      email: "darren.hemming@clouddesignbox.co.uk",
      personLinkedInUrl: "https://www.linkedin.com/in/darren-hemming-475ab217/",
    });
    expect(alwaysShowContactIcons("clouddesignbox.co.uk")).toBe(true);
  });

  it("imports all 22 CodeMonkey contacts with stored mobile and keeps the directory contact", async () => {
    const stored = (await import("@/data/company-contacts/codemonkey.com.json")).default;
    expect(stored.contacts).toHaveLength(22);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "1 888 299 3294")).toBe(true);

    const contacts = getCompanyContacts("codemonkey.com", {
      companyName: "Codemonkey",
      firstName: "Jonathan",
      lastName: "Schor",
      designation: "CEO & co-Founder",
      email: "jonathan@codemonkey.com",
      phone: "1 888 299 3294",
      country: "Israel",
      personLinkedInUrl: "https://il.linkedin.com/in/schory",
      companyLinkedInUrl: "https://www.linkedin.com/company/codemonkeystu/",
    })!;
    expect(contacts).toHaveLength(23);
    expect(contacts[0].fullName).toBe("Tyler Bates");
    expect(contacts[21].fullName).toBe("Daniel Johnson");
    expect(contacts.every((c) => c.mobile === "1 888 299 3294")).toBe(true);
    expect(contacts.slice(0, 22).every((c) => c.company === "CodeMonkey")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/codemonkeystu/")).toBe(true);
    // Ido Schor (sheet) is not the directory's Jonathan Schor.
    expect(contacts.find((c) => c.fullName === "Ido Schor")!.email).toBeNull();
    expect(contacts[22]).toMatchObject({
      fullName: "Jonathan Schor",
      email: "jonathan@codemonkey.com",
      personLinkedInUrl: "https://il.linkedin.com/in/schory",
    });
    expect(alwaysShowContactIcons("codemonkey.com")).toBe(true);
  });

  it("imports 26 Community Playthings contacts (one exact duplicate dropped) and keeps the directory contact", async () => {
    const stored = (await import("@/data/company-contacts/communityplaythings.co.uk.json")).default;
    expect(stored.contacts).toHaveLength(26);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 1580 883310")).toBe(true);

    const contacts = getCompanyContacts("communityplaythings.co.uk", {
      companyName: "Community Playthings",
      firstName: "Nate",
      lastName: "Hine",
      designation: "International Sales Manager",
      email: "natehine@communityplaythings.co.uk",
      phone: "44 1580 883310",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/nate-hine-17490326b/",
      companyLinkedInUrl: "https://www.linkedin.com/company/community-playthings-uk/",
    })!;
    expect(contacts).toHaveLength(27);
    expect(contacts[0].fullName).toBe("Phil Martin");
    expect(contacts[25].fullName).toBe("Fiona Fransham");
    // Carol Kleinsasser's two rows differ only by city → shown once.
    expect(contacts.filter((c) => c.fullName === "Carol Kleinsasser")).toHaveLength(1);
    // Holly Spalding's two rows have different titles → both shown.
    expect(contacts.filter((c) => c.fullName === "Holly Spalding").map((c) => c.jobTitle)).toEqual([
      "Account Manager",
      "Customer Service Specialist",
    ]);
    expect(contacts.every((c) => c.mobile === "44 1580 883310")).toBe(true);
    expect(contacts.slice(0, 26).every((c) => c.company === "Community Playthings UK")).toBe(true);
    expect(
      contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/community-playthings-uk/")
    ).toBe(true);
    expect(contacts[26]).toMatchObject({
      fullName: "Nate Hine",
      email: "natehine@communityplaythings.co.uk",
      personLinkedInUrl: "https://www.linkedin.com/in/nate-hine-17490326b/",
    });
    expect(alwaysShowContactIcons("communityplaythings.co.uk")).toBe(true);
  });

  it("imports all 23 Cosafe contacts and does not give Jonas Strandell someone else's LinkedIn", async () => {
    const stored = (await import("@/data/company-contacts/cosafe.com.json")).default;
    expect(stored.contacts).toHaveLength(23);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "46 840 940 020")).toBe(true);

    const contacts = getCompanyContacts("cosafe.com", {
      companyName: "Cosafe Technology AB",
      firstName: "Jonas",
      lastName: "Strandell",
      designation: "CMO",
      email: "jonas.strandell@cosafe.com",
      phone: "46 840 940 020",
      country: "Sweden",
      personLinkedInUrl: "https://www.linkedin.com/in/joakim-genetay-9430867/?originalSubdomain=se",
      companyLinkedInUrl: "https://www.linkedin.com/company/cosafe/",
    })!;
    expect(contacts).toHaveLength(23);
    expect(contacts[0]).toMatchObject({
      fullName: "Jonas Strandell",
      email: "jonas.strandell@cosafe.com",
      personLinkedInUrl: null, // directory link is /in/joakim-genetay — not his
    });
    expect(contacts.map((c) => c.fullName)).toContain("Piotr Dżaluk");
    expect(contacts.every((c) => c.mobile === "46 840 940 020")).toBe(true);
    expect(contacts.every((c) => c.company === "Cosafe Technology")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/cosafe/")).toBe(true);
    expect(alwaysShowContactIcons("cosafe.com")).toBe(true);
  });

  it("imports the 75 unique Compro contacts, realigns Ravi Ranjan, and keeps the directory contact", async () => {
    const stored = (await import("@/data/company-contacts/comprotechnologies.com.json")).default;
    expect(stored.contacts).toHaveLength(75);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "91 11 42011900")).toBe(true);

    const contacts = getCompanyContacts("comprotechnologies.com", {
      companyName: "Compro Technologies Private Limited",
      firstName: "Arun",
      lastName: "Nair",
      designation: "Senior Vice President",
      email: "arun.nair@comprotechnologies.com",
      phone: "91 11 42011900",
      country: "India",
      personLinkedInUrl: "https://www.linkedin.com/in/arun-nair-3263a749",
      companyLinkedInUrl: "https://www.linkedin.com/company/compro-technologies/",
    })!;
    expect(contacts).toHaveLength(76);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(76);
    expect(contacts[0].fullName).toBe("Sejal Mathur");
    expect(contacts[74].fullName).toBe("Yashi Jain");
    expect(contacts.find((c) => c.fullName === "Ravi Ranjan")).toMatchObject({
      jobTitle: "Senior Manager - Visual Design, Graphics & UI/UX",
      country: "India",
    });
    expect(new Set(contacts.map((c) => c.country))).toEqual(new Set(["India", "Spain", "United States"]));
    expect(contacts.every((c) => c.mobile === "91 11 42011900")).toBe(true);
    expect(contacts.slice(0, 75).every((c) => c.company === "Compro Technologies")).toBe(true);
    expect(contacts[75]).toMatchObject({
      fullName: "Arun Nair",
      email: "arun.nair@comprotechnologies.com",
      personLinkedInUrl: "https://www.linkedin.com/in/arun-nair-3263a749",
    });
    expect(alwaysShowContactIcons("comprotechnologies.com")).toBe(true);
  });

  it("imports all 68 CPOMS contacts in order with the stored mobile", async () => {
    const stored = (await import("@/data/company-contacts/cpoms.co.uk.json")).default;
    expect(stored.contacts).toHaveLength(68);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 1756 79 7766")).toBe(true);

    const contacts = getCompanyContacts("cpoms.co.uk", {
      companyName: "CPOMS Systems Limited",
      firstName: "Rachel",
      lastName: "Green",
      designation: "Marketing Communications Manager",
      email: "rachel.green@cpoms.co.uk",
      phone: "44 1756 79 7766",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/rachel-green-8264035b",
      companyLinkedInUrl: "https://www.linkedin.com/company/cpomsuk/",
    })!;
    expect(contacts).toHaveLength(68);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(68);
    expect(contacts[0].fullName).toBe("Oluwaseyi Aimudo");
    expect(contacts[67].fullName).toBe("Wiktoria Plata");
    expect(contacts.every((c) => c.mobile === "44 1756 79 7766")).toBe(true);
    expect(contacts.every((c) => c.company === "CPOMS Systems")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/cpomsuk/")).toBe(true);
    expect(contacts[3]).toMatchObject({
      fullName: "Rachel Green",
      email: "rachel.green@cpoms.co.uk",
      personLinkedInUrl: "https://www.linkedin.com/in/rachel-green-8264035b",
    });
    expect(alwaysShowContactIcons("cpoms.co.uk")).toBe(true);
  });

  it("imports all 71 CRB Cunninghams rows in order with the stored mobile", async () => {
    const stored = (await import("@/data/company-contacts/crbcunninghams.co.uk.json")).default;
    expect(stored.contacts).toHaveLength(71);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 333 014 3065")).toBe(true);

    const contacts = getCompanyContacts("crbcunninghams.co.uk", {
      companyName: "CRB Cunninghams",
      firstName: "Katie",
      lastName: "Barker",
      designation: "Marketing Executive",
      email: "katie.barker@crbcunninghams.co.uk",
      phone: "44 333 014 3065",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/katie-barker-82400a257",
      companyLinkedInUrl: "https://www.linkedin.com/company/crb-cunninghams/?originalSubdomain=uk",
    })!;
    expect(contacts).toHaveLength(71);
    expect(contacts[0].fullName).toBe("Sarah Williams");
    expect(contacts[70].fullName).toBe("Brian Highley");
    expect(contacts.every((c) => c.mobile === "44 333 014 3065")).toBe(true);
    expect(contacts.every((c) => c.company === "CRB Cunninghams")).toBe(true);
    expect(
      contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/crb-cunninghams/?originalSubdomain=uk")
    ).toBe(true);
    expect(contacts.find((c) => c.fullName === "Katie Barker")).toMatchObject({
      email: "katie.barker@crbcunninghams.co.uk",
      personLinkedInUrl: "https://www.linkedin.com/in/katie-barker-82400a257",
    });
    // Kept as the sheet has it (flagged to the owner): not obviously a person.
    expect(contacts.find((c) => c.fullName === "The Marketing Manager")!.jobTitle).toBe("Company Profile");
    expect(alwaysShowContactIcons("crbcunninghams.co.uk")).toBe(true);
  });

  it("imports all 42 Crick Software contacts in order with the stored mobile", async () => {
    const stored = (await import("@/data/company-contacts/cricksoft.com.json")).default;
    expect(stored.contacts).toHaveLength(42);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 1604 671691")).toBe(true);

    const contacts = getCompanyContacts("cricksoft.com", {
      companyName: "Crick Software Ltd",
      firstName: "Lina",
      lastName: "Howarth",
      designation: "Chief Executive Officer",
      email: "lina.howarth@cricksoft.com",
      phone: "44 1604 671691",
      country: "United Kingdom",
      personLinkedInUrl: "https://uk.linkedin.com/in/lina-howarth-6922ba183",
      companyLinkedInUrl: "https://www.linkedin.com/company/crick-software-ltd/",
    })!;
    expect(contacts).toHaveLength(42);
    expect(contacts[0].fullName).toBe("Kyle Odierno");
    expect(contacts[41].fullName).toBe("Deborah Livingstone");
    expect(contacts.every((c) => c.mobile === "44 1604 671691")).toBe(true);
    expect(contacts.every((c) => c.company === "Crick Software")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/crick-software-ltd/")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Lina Howarth")).toMatchObject({
      email: "lina.howarth@cricksoft.com",
      personLinkedInUrl: "https://uk.linkedin.com/in/lina-howarth-6922ba183",
    });
    expect(contacts.filter((c) => c.fullName === "John Crick").map((c) => c.jobTitle)).toEqual([
      "CEO",
      "Founder & Chairman",
    ]);
    expect(contacts.map((c) => c.fullName)).toContain("Siân Rice");
    expect(alwaysShowContactIcons("cricksoft.com")).toBe(true);
  });

  it("imports all 6 Data Harvest rows in order with the stored mobile", async () => {
    const stored = (await import("@/data/company-contacts/data-harvest.co.uk.json")).default;
    expect(stored.contacts).toHaveLength(6);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 1525 373666")).toBe(true);

    const contacts = getCompanyContacts("data-harvest.co.uk", {
      companyName: "Data Harvest",
      firstName: "Lee",
      lastName: "Grahame",
      designation: "Managing Director",
      email: "lee.grahame@data-harvest.co.uk",
      phone: "44 1525 373666",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/leegrahame/",
      companyLinkedInUrl: "https://www.linkedin.com/company/data-harvest-group-ltd/",
    })!;
    expect(contacts.map((c) => c.fullName.split(" ").slice(0, 2).join(" "))).toEqual([
      "Nick Brown",
      "Lee Grahame",
      "Ben Collins",
      "Connie Lwichi",
      "Neil Morgan",
      "Yes Yes",
    ]);
    expect(contacts.every((c) => c.mobile === "44 1525 373666")).toBe(true);
    expect(contacts.every((c) => c.company === "Data Harvest Group")).toBe(true);
    expect(contacts[1]).toMatchObject({
      email: "lee.grahame@data-harvest.co.uk",
      personLinkedInUrl: "https://www.linkedin.com/in/leegrahame/",
    });
    expect(alwaysShowContactIcons("data-harvest.co.uk")).toBe(true);
  });

  it("imports all 4 Deesha rows with no shared mobile, folding in the directory contact", () => {
    const contacts = getCompanyContacts("deesha.ai", {
      companyName: "Deesha",
      firstName: "Amy",
      lastName: "Martin Amima",
      designation: "Product and Education Data Lead",
      email: "amy.martin@deesha.ai",
      phone: null,
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/amy-martin-71466aa6/",
      companyLinkedInUrl: "https://www.linkedin.com/company/deesha-ai/",
    })!;
    expect(contacts.map((c) => `${c.fullName} | ${c.jobTitle}`)).toEqual([
      "Nidhi Sharma | Advisor",
      "Amy Martin Amima | Product and Education Data Lead",
      "Kb Thapa | Digital Marketing Intern",
      "Nidhi Sharma | Advisor, consultant",
    ]);
    expect(contacts.every((c) => c.mobile === null)).toBe(true);
    expect(contacts.every((c) => c.company === "Deesha")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/deesha-ai/")).toBe(true);
    expect(contacts[1]).toMatchObject({
      email: "amy.martin@deesha.ai",
      personLinkedInUrl: "https://www.linkedin.com/in/amy-martin-71466aa6/",
    });
    expect(alwaysShowContactIcons("deesha.ai")).toBe(true);
  });

  it("imports all 3 Dily contacts, treating 'Not Available' as empty", () => {
    const contacts = getCompanyContacts("dilyclass.com", {
      companyName: "Dily",
      firstName: "Atakan",
      lastName: "Uyduran",
      designation: "Co-Founder & CEO",
      email: "atakan@dilyclass.com",
      phone: null,
      country: "Türkiye",
      personLinkedInUrl: "https://www.linkedin.com/in/atakan-uyduran/",
      companyLinkedInUrl: "https://www.linkedin.com/company/dilyclass",
    })!;
    expect(contacts.map((c) => `${c.fullName} | ${c.jobTitle}`)).toEqual([
      "Atakan Uyduran | Co-Founder & CEO",
      "Eda Çakır | Business Development Intern",
      "Kerem Akşahin | Proje Yönetimi Stajyeri",
    ]);
    expect(contacts[0]).toMatchObject({
      email: "atakan@dilyclass.com",
      personLinkedInUrl: "https://www.linkedin.com/in/atakan-uyduran/",
    });
    expect(contacts.slice(1).every((c) => c.email === null && c.mobile === null)).toBe(true);
    expect(contacts.every((c) => c.mobile === null && c.company === "Dily")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/dilyclass")).toBe(true);
    expect(alwaysShowContactIcons("dilyclass.com")).toBe(true);
  });

  it("imports all 12 Docex 360 contacts in order with the stored mobile", async () => {
    const stored = (await import("@/data/company-contacts/docex360.co.uk.json")).default;
    expect(stored.contacts).toHaveLength(12);
    expect(stored.contacts.every((c: { mobile: string | null }) => c.mobile === "44 1403 338608")).toBe(true);

    const contacts = getCompanyContacts("docex360.co.uk", {
      companyName: "Docex 360",
      firstName: "Ben",
      lastName: "Coughlan",
      designation: "Director - Owner",
      email: "ben.coughlan@docex360.co.uk",
      phone: "44 1403 338608",
      country: "United Kingdom",
      personLinkedInUrl: "https://www.linkedin.com/in/ben-coughlan-3a355217",
      companyLinkedInUrl: "https://www.linkedin.com/company/docex360/",
    })!;
    expect(contacts).toHaveLength(12);
    expect(contacts[0].fullName).toBe("Kiri Hewitt");
    expect(contacts[11].fullName).toBe("Jack Nye");
    expect(contacts.every((c) => c.mobile === "44 1403 338608")).toBe(true);
    expect(contacts.every((c) => c.company === "Docex360")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/docex360/")).toBe(true);
    expect(contacts[2]).toMatchObject({
      fullName: "Ben Coughlan",
      email: "ben.coughlan@docex360.co.uk",
      personLinkedInUrl: "https://www.linkedin.com/in/ben-coughlan-3a355217",
    });
    // Ben Hall shares a first name but is not the directory's Ben Coughlan.
    expect(contacts[1].email).toBeNull();
    expect(alwaysShowContactIcons("docex360.co.uk")).toBe(true);
  });

  it("imports all 84 Edpuzzle contacts in order with the owner's shared mobile", () => {
    const contacts = getCompanyContacts("edpuzzle.com", {
      companyName: "Edpuzzle",
      firstName: "Sage",
      lastName: "Streicher",
      designation: "Marketing Coordinator",
      email: "sage@edpuzzle.com",
      phone: "1 650 336 4934",
      country: "United States",
      personLinkedInUrl: "https://www.linkedin.com/in/sagestreicher/",
      companyLinkedInUrl: "https://www.linkedin.com/company/edpuzzle-inc-/",
    })!;
    expect(contacts).toHaveLength(84);
    expect(new Set(contacts.map((c) => c.fullName)).size).toBe(84);
    expect(contacts[0].fullName).toBe("Albert Hernández Pellicer");
    expect(contacts[83].fullName).toBe("Sneha Tharayil");
    expect(contacts.every((c) => c.company === "Edpuzzle")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/edpuzzle-inc-/")).toBe(true);
    // 2026-11-22: owner's number on every Edpuzzle row.
    expect(contacts.every((c) => c.mobile === "1 650 336 4934")).toBe(true);
    expect(contacts.find((c) => c.fullName === "Sage Streicher")).toMatchObject({
      email: "sage@edpuzzle.com",
      personLinkedInUrl: "https://www.linkedin.com/in/sagestreicher/",
    });
    expect(alwaysShowContactIcons("edpuzzle.com")).toBe(true);
  });

  it("imports all 3 EDUSOFX contacts with no shared mobile, folding in the directory contact", () => {
    const contacts = getCompanyContacts("edusofx.com", {
      companyName: "EDUSOFX",
      firstName: "Hatem",
      lastName: "Sallam",
      designation: "Co-Founder and CEO",
      email: "hatem@edusofx.com",
      phone: null,
      country: "United Arab Emirates",
      personLinkedInUrl: "https://www.linkedin.com/in/hsallam",
      companyLinkedInUrl: "https://www.linkedin.com/company/edusofx/",
    })!;
    expect(contacts.map((c) => `${c.fullName} | ${c.country}`)).toEqual([
      "Hatem Sallam | United Arab Emirates",
      "Ahmed Tolba | Egypt",
      "Islam Shaalan | Canada",
    ]);
    expect(contacts[0]).toMatchObject({ email: "hatem@edusofx.com", personLinkedInUrl: "https://www.linkedin.com/in/hsallam" });
    expect(contacts.every((c) => c.mobile === null && c.company === "EduSofx")).toBe(true);
    expect(contacts.every((c) => c.companyLinkedInUrl === "https://www.linkedin.com/company/edusofx/")).toBe(true);
    expect(alwaysShowContactIcons("edusofx.com")).toBe(true);
  });

  describe("2026-11-22 batch of 18 companies", () => {
    const batch: Array<{
      domain: string;
      count: number;
      first: string;
      company: string | null;
      mobile: string | null; // null = preserve (files carry none)
    }> = [
      { domain: "eduflix.com", count: 2, first: "Lina Lindqvist", company: "Eduflix", mobile: null },
      { domain: "edutech.global", count: 19, first: "Oriyomi Ogunro", company: "EduTech Global", mobile: null },
      { domain: "epson.co.uk", count: 99, first: "Phil Mcmullin", company: "Epson UK & I", mobile: null },
      { domain: "eset.com", count: 50, first: "Alexander Stoyanov", company: "Eset Uk", mobile: "44 1202 405 405" },
      { domain: "everybodycounts.org.uk", count: 1, first: "Christian Fuller", company: "Everybody Counts Limited", mobile: null },
      { domain: "fortinet.com", count: 99, first: "Allan Lau", company: "Fortinet", mobile: "+1-866-868-3678" },
      { domain: "geckoengage.com", count: 37, first: "Jonny Richardson", company: "Gecko | AI-Powered Student Engagement Platform", mobile: "44 131 541 2296" },
      { domain: "globisens.net", count: 4, first: "Steven Morrison", company: "Globalsense", mobile: null },
      { domain: "etapa.com.br", count: 100, first: "Simone De Farias", company: "ETAPA Educacional", mobile: null },
      { domain: "hp.com", count: 4, first: "Jason Hewins", company: "Hp Inc Uk Limited", mobile: "1 650 857 1501" },
      { domain: "hyetteducation.com", count: 11, first: "Antony Hyett", company: "Hyett Education", mobile: "44 7715579033" },
      { domain: "i-screammedia.com", count: 36, first: "Chris Kihwan Lee", company: "i-Scream Media", mobile: "+82-2-3440-2300" },
      { domain: "ict-direct.co.uk", count: 5, first: "Dave Foulks", company: "ICT Direct - Refurbished Computer Hardware", mobile: "44 1254 820 980" },
      { domain: "indivi.tech", count: 13, first: "Ece Bilgenur Demir", company: "indivitech", mobile: "90 539 843 77 54" },
      { domain: "indota.com", count: 2, first: "Yeria Cerón Mendoza", company: "Indota", mobile: "31 592 201 351" },
      { domain: "infento.com", count: 10, first: "Sander Letema", company: null, mobile: "31 20 261 64 50" },
      { domain: "intel.com", count: 1, first: "Priya Iyer", company: "Intel Corporation-US", mobile: null },
      { domain: "interactive365.co.uk", count: 3, first: "George Spree", company: "Interactive365", mobile: "44 20 3621 4714" },
    ];

    it.each(batch)("$domain: $count stored contacts in sheet order, own mobile rule, icons on", async (entry) => {
      const stored = (await import(`@/data/company-contacts/${entry.domain}.json`)).default as {
        contacts: Array<{ fullName: string; company: string | null; mobile: string | null }>;
      };
      expect(stored.contacts).toHaveLength(entry.count);
      expect(stored.contacts[0].fullName).toBe(entry.first);
      if (entry.company) expect(stored.contacts.every((c) => c.company === entry.company)).toBe(true);
      if (entry.mobile) {
        expect(stored.contacts.every((c) => c.mobile === entry.mobile)).toBe(true);
        expect(getCompanyContacts(entry.domain)!.every((c) => c.mobile === entry.mobile)).toBe(true);
      } else {
        expect(stored.contacts.every((c) => c.mobile === null)).toBe(true);
      }
      expect(alwaysShowContactIcons(entry.domain)).toBe(true);
    });

    it("never carries one company's mobile number into another company", () => {
      const numbers = batch.filter((b) => b.mobile).map((b) => [b.domain, b.mobile] as const);
      for (const { domain } of batch) {
        const contacts = getCompanyContacts(domain)!;
        for (const [owner, number] of numbers) {
          if (owner !== domain) expect(contacts.some((c) => c.mobile === number)).toBe(false);
        }
      }
    });

    it("keeps Intel's Priya Iyer out of Interactive365 and the Epson/Fortinet blank-name rows out", () => {
      expect(getCompanyContacts("interactive365.co.uk")!.map((c) => c.fullName)).toEqual([
        "George Spree",
        "Deniss Dmitrijev",
        "Alexandra Chichko",
      ]);
      for (const domain of ["epson.co.uk", "fortinet.com"]) {
        expect(getCompanyContacts(domain)!.every((c) => c.fullName.trim().length > 0)).toBe(true);
      }
    });

    it("realigns EduTech Global's shifted row and keeps one Jenni Bristow at Hyett", () => {
      expect(getCompanyContacts("edutech.global")!.find((c) => c.fullName === "Nimat Asunogie")).toMatchObject({
        jobTitle: "Head, Branding, Marketing & Communications",
        email: null,
        mobile: null,
        country: "Nigeria",
      });
      expect(getCompanyContacts("hyetteducation.com")!.filter((c) => c.fullName === "Jenni Bristow")).toHaveLength(1);
    });
  });

  it("returns null for companies without an imported list", () => {
    expect(getCompanyContacts("example-no-list.com")).toBeNull();
    expect(getCompanyContacts(null)).toBeNull();
  });
});
