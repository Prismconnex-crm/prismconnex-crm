import { describe, expect, it } from 'vitest';
import registryFile from '@/data/find-shows-hero-images.json';
import denylistFile from '@/data/find-shows-hero-image-denylist.json';
import { createHeroImageClaims } from '@/lib/find-shows/event-hero-image';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import {
  getHeroRegistryEntries,
  getRegisteredHeroImage,
  isDeniedHeroImage,
  screenAutomaticHeroImage,
  registryEntryProblem,
  type HeroRegistryEntry,
} from '@/lib/find-shows/hero-image-registry';

const VALID: HeroRegistryEntry = {
  slug: 'test-expo-city-2027-04-13',
  eventName: 'TEST EXPO',
  catalogStartDate: '2027-04-13',
  status: 'verified',
  imageUrl: 'https://example.com/test-expo-2026.jpg',
  width: 2000,
  height: 1200,
  sourcePageUrl: 'https://example.com/',
  attribution: "Under the page heading 'Scenes from Test Expo 2026'.",
  editionYear: 2026,
  previousEdition: true,
  editionLabel: 'Test Expo 2026',
  verifiedOn: '2026-10-11',
};

describe('find shows hero registry', () => {
  it('loads every entry in the data file — none is silently dropped', () => {
    const problems = (registryFile.entries as HeroRegistryEntry[])
      .map((entry) => [entry.slug, registryEntryProblem(entry)])
      .filter(([, problem]) => problem);
    expect(problems).toEqual([]);
    expect(getHeroRegistryEntries()).toHaveLength(registryFile.entries.length);
  });

  it('only holds entries for real catalog events, verified against their current edition', () => {
    for (const entry of getHeroRegistryEntries()) {
      const event = findShowEventsBySlug[entry.slug];
      expect(event, entry.slug).toBeDefined();
      expect(event.name).toBe(entry.eventName);
      // A new catalog edition must be re-verified, not inherit the old photo silently.
      expect(event.startDate).toBe(entry.catalogStartDate);
    }
  });

  it('holds one entry per event', () => {
    const slugs = getHeroRegistryEntries().map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('labels a previous-edition photo with its own year, and a current one not at all', () => {
    expect(getRegisteredHeroImage('malms-military-aviation-logistics-and-maintenance-symposium-orlando-fl-2027-04-13')).toMatchObject({
      previousEditionLabel: 'MALMS 2026',
      width: 2000,
    });
    expect(getRegisteredHeroImage('middle-east-event-show-dubai-2026-08-18')).toMatchObject({ previousEditionLabel: 'MEES 2025' });
    expect(getRegisteredHeroImage('not-in-the-registry')).toBeNull();
  });

  it('maps the three first-round previous-edition photos to their verified images and years', () => {
    expect(getRegisteredHeroImage('festival-of-quilts-adelaide-2027-07-01')).toEqual({
      url: 'https://www.saquilters.org.au/wp-content/uploads/2026/08/Down-Under-Botanical-scaled.jpg',
      width: 2560,
      height: 1881,
      previousEditionLabel: 'Festival of Quilts 2026',
    });
    expect(getRegisteredHeroImage('best-practice-birmingham-birmingham-2026-10-07')).toEqual({
      url: 'https://cdn.asp.events/CLIENT_CloserSt_D86EA381_5056_B739_5482D50A1A831DDD/sites/best-practice-2026/media/galleries/best-practice-birmingham-respiratory-professional-care-2025/Best-Practice-Birmingham-Respiratory-Professional-Care-2025-14-.jpg',
      width: 1920,
      height: 1280,
      previousEditionLabel: 'Best Practice 2025',
    });
    expect(getRegisteredHeroImage('horeca-vakbeurs-hardenberg-2027-02-01')).toEqual({
      url: 'https://easyfairsassets.com/sites/278/2026/02/Beursvloer_KevinvlPhotography_20260203_142716_HORECAVAK_DSC01969_LR.jpg',
      width: 1200,
      height: 800,
      previousEditionLabel: 'Horeca Vakbeurs 2026',
    });
  });

  it('labels each batch-6 gallery photo with the edition its source page names', () => {
    const batch6: [slug: string, label: string, host: string][] = [
      ['baumesse-offenbach-offenbach-am-main-2027-01-15', 'Baumesse Offenbach 2026', 'www.baumesse.de'],
      ['c-print-madrid-madrid-2027-01-12', 'C!Print Madrid 2026', 'mobicheckin-assets.s3.eu-west-1.amazonaws.com'],
      ['millesime-bio-montpellier-2027-01-25', 'Millésime BIO 2026', 'mobicheckin-assets.s3.eu-west-1.amazonaws.com'],
      ['spatex-coventry-2027-02-02', 'SPATEX 2026', 'cdn.asp.events'],
      ['breakbulk-middle-east-dubai-2027-02-02', 'Breakbulk Middle East 2026', 'ite-prod-cdn-end.azureedge.net'],
      ['for-wood-prague-2027-02-11', 'FOR WOOD 2025', 'for-wood.cz'],
      ['strechy-praha-roofs-prague-prague-2027-02-11', 'Střechy Praha 2025', 'www.strechy-praha.cz'],
      ['horticontact-gorinchem-2027-02-10', 'HortiContact 2026', 'easyfairsassets.com'],
      ['eurocis-dusseldorf-2027-02-16', 'EuroCIS 2025', 'www.eurocis.com'],
      ['catex-dublin-2027-02-16', 'CATEX 2025', 'catexexhibition.com'],
      ['saltwater-sportfishing-show-salem-or-2027-02-27', 'Saltwater Show 2026', 'oceaned.org'],
      ['bauen-wohnen-luzern-lucerne-2027-02-26', 'Bauen+Wohnen 2025', 'www.messe-luzern.ch'],
      ['yugbuild-krasnodar-2027-03-02', 'YugBuild 2024', 'www.yugbuild.com'],
      ['apimell-piacenza-2027-03-05', 'APIMELL 2026', 'www.apimell.it'],
    ];
    for (const [slug, label, host] of batch6) {
      const image = getRegisteredHeroImage(slug);
      expect(image, slug).not.toBeNull();
      expect(image!.previousEditionLabel, slug).toBe(label);
      expect(new URL(image!.url).hostname, slug).toBe(host);
    }
  });

  it('labels each batch-7 photo with the edition its source page names', () => {
    const batch7: [slug: string, label: string][] = [
      ['aquatech-amsterdam-amsterdam-2027-03-09', 'Aquatech Amsterdam 2025'],
      ['barbecue-expo-paris-2027-03-12', 'Barbecue Expo 2026'],
      ['b-travel-barcelona-2027-03-12', 'B-Travel 2026'],
      ['world-olive-oil-exhibition-madrid-2027-03-10', 'WOOE 2025'],
      ['care-show-japan-tokyo-2027-03-17', 'Care Show Japan 2026'],
      ['art-central-hong-kong-2027-03-24', 'Art Central 2025'],
      ['shop-le-salon-paris-2027-03-24', 'SHOP! Le Salon 2026'],
      ['for-interior-prague-2027-03-01', 'For Interior autumn 2026'],
      ['for-pets-prague-2027-04-01', 'FOR PETS 2023'],
      ['fruit-attraction-sao-paulo-sao-paulo-2027-04-06', 'Fruit Attraction 2026'],
      ['textiles-recycling-expo-usa-charlotte-nc-2027-04-07', 'Textiles Recycling 2026'],
      ['baumesse-darmstadt-darmstadt-2027-04-16', 'Baumesse Darmstadt 2025'],
      ['exposanita-bologna-2027-04-14', 'Exposanità 2026'],
      ['interfood-krasnodar-krasnodar-2027-04-21', 'InterFood Krasnodar 2025'],
      ['oca-st-gallen-2027-04-21', 'OCA 2026'],
      ['egy-beauty-and-clean-expo-cairo-2027-04-24', 'Egy Beauty 2024'],
      ['european-coatings-show-nuremberg-2027-04-27', 'Coatings Show 2025'],
      ['ict-africa-summit-algiers-2027-04-01', 'ICT Africa Summit 2026'],
      ['san-francisco-art-fair-san-francisco-ca-2027-04-01', 'San Francisco Art Fair 2026'],
      ['graphispag-barcelona-2027-05-04', 'Graphispag 2024'],
      ['eastec-west-springfield-ma-2027-05-11', 'EASTEC 2025'],
      ['breakbulk-europe-rotterdam-2027-05-11', 'Breakbulk Europe 2026'],
      ['chemuk-expo-birmingham-2027-05-19', 'CHEMUK 2025'],
      ['beauty-show-krasnodar-krasnodar-2027-05-26', 'Beauty Show 2025'],
      ['thailand-dive-expo-bangkok-2027-05-01', 'Thailand Dive Expo 2025'],
      ['intertraffic-americas-mexico-city-2027-06-08', 'Intertraffic Americas 2025'],
      ['ambiente-lavoro-bologna-2027-06-08', 'Ambiente Lavoro 2026'],
      ['ivt-expo-industrial-vehicle-technology-cologne-2027-06-09', 'iVT Expo 2026'],
      ['spi-screen-print-innovations-essen-2027-06-15', 'SPI 2025'],
    ];
    for (const [slug, label] of batch7) {
      expect(getRegisteredHeroImage(slug)?.previousEditionLabel, slug).toBe(label);
    }
  });

  it('shows the FOR INTERIOR autumn-2026 photo unlabelled on its own edition and labelled on the next', () => {
    const autumn = getRegisteredHeroImage('for-interior-prague-2026-10-02');
    const spring = getRegisteredHeroImage('for-interior-prague-2027-03-01');
    expect(autumn).not.toBeNull();
    expect(autumn!.previousEditionLabel).toBeUndefined();
    expect(spring!.url).toBe(autumn!.url);
    expect(spring!.previousEditionLabel).toBe('For Interior autumn 2026');
  });

  it('shows batch-8 photos of an edition that has already taken place unlabelled', () => {
    const currentEdition = [
      'bengaluru-space-expo-bangalore-2026-09-07',
      'autumn-fair-birmingham-2026-09-06',
      'ineltec-zurich-2026-09-09',
      'design-london-shoreditch-london-2026-09-15',
      'surcar-asia-shanghai-2026-09-16',
      'taiwan-innotech-expo-taipei-2026-09-17',
      'itcs-koln-cologne-2026-09-18',
      'euro-defence-expo-essen-2026-09-22',
      'retail-show-australia-melbourne-2026-09-22',
      'breakbulk-americas-houston-tx-2026-09-22',
      'security-essen-essen-2026-09-22',
      'pol-eco-system-poznan-2026-10-20',
    ];
    for (const slug of currentEdition) {
      const image = getRegisteredHeroImage(slug);
      expect(image, slug).not.toBeNull();
      expect(image!.previousEditionLabel, slug).toBeUndefined();
      expect(image!.url.startsWith('https://'), slug).toBe(true);
    }
  });

  it('labels each batch-8 previous-edition photo with the edition its source page names', () => {
    const batch8: [slug: string, label: string][] = [
      ['atmosphere-america-summit-2027-06-01', 'ATMOsphere 2026'],
      ['international-police-expo-new-delhi-2027-06-01', 'Police Expo 2025'],
      ['jimex-amman-2027-06-01', 'JIMEX 2024'],
      ['seattle-art-fair-seattle-wa-2027-07-01', 'Seattle Art Fair 2026'],
      ['for-decor-and-present-prague-2026-09-09', 'FOR DECOR 2025'],
      ['expoalimentaria-peru-lima-2026-09-23', 'Expoalimentaria 2025'],
      ['ahr-expo-mexico-guadalajara-2026-09-29', 'AHR Expo México 2025'],
      ['fruit-attraction-madrid-2026-10-06', 'Fruit Attraction 2025'],
      ['comtrans-kazan-2026-10-06', 'COMTRANS 2024'],
      ['baumesse-bad-kreuznach-bad-kreuznach-2026-10-16', 'Baumesse Kreuznach 2025'],
      ['ad-tech-tokyo-tokyo-2026-10-21', 'ad:tech tokyo 2025'],
      ['adelaide-4wd-and-adventure-show-adelaide-2026-10-23', 'Adelaide 4WD Show 2024'],
      ['jimtof-tokyo-2026-10-26', 'JIMTOF 2024'],
      ['licensing-show-asean-bangkok-2026-11-03', 'Licensing ASEAN 2025'],
      ['smart-city-expo-barcelona-2026-11-03', 'Smart City Expo 2025'],
      ['bau-energie-messe-bern-2026-11-05', 'Bau+Energie 2025'],
      ['logistics-and-automation-madrid-madrid-2026-11-11', 'L&A Madrid 2025'],
      ['logistic-and-industrial-build-madrid-madrid-2026-11-11', 'LIB Madrid 2025'],
      ['empack-madrid-madrid-2026-11-11', 'Empack Madrid 2025'],
      ['indiairport-gandhinagar-2026-11-19', 'IndiAirport 2023'],
      ['agroexpo-uzbekistan-agrotech-expo-horti-uzbekistan-tashkent-2026-11-25', 'AgroExpo Uzbekistan 2025'],
      ['sfitex-st-petersburg-2026-11-24', 'Sfitex 2025'],
      ['heim-handwerk-munich-2026-11-25', 'Heim+Handwerk 2025'],
    ];
    for (const [slug, label] of batch8) {
      expect(getRegisteredHeroImage(slug)?.previousEditionLabel, slug).toBe(label);
    }
  });

  it('never gives one show the photos another show of the same organiser is captioned with', () => {
    // The International Police Expo 2025 gallery is also linked from the organiser's
    // Homeland Security Expo listing; only the event named in the captions gets it.
    const police = getRegisteredHeroImage('international-police-expo-new-delhi-2027-06-01');
    const others = getHeroRegistryEntries().filter((entry) => entry.slug !== 'international-police-expo-new-delhi-2027-06-01');
    expect(others.some((entry) => entry.imageUrl === police!.url)).toBe(false);
  });

  it('migrates the 10 audit-verified previous-edition photos with their own year', () => {
    const migrated: [slug: string, label: string, url: string][] = [
      ['zootechnia-thessaloniki-2027-01-28', 'Zootechnia 2025', 'https://www.zootechnia-expo.gr/wp-content/uploads/2025/01/'],
      ['kbis-kitchen-and-bath-industry-show-las-vegas-nv-2027-02-02', 'KBIS 2024', 'https://kbis.com/wp-content/uploads/2026/02/0191_PWP_EmeraldX_KBIS26'],
      ['emitt-istanbul-istanbul-2027-02-04', 'EMITT 2026', 'https://emittistanbul.com/slider/project_file_33_1742904115.jpg'],
      ['hauslbauermesse-klagenfurt-klagenfurt-2027-02-19', 'Häuslbauermesse 2026', 'https://b3326075.assetcdn.net/'],
      ['udt-europe-undersea-defence-technology-glasgow-2027-04-06', 'UDT 2025', 'https://cdn.asp.events/'],
      ['adex-singapore-asia-dive-expo-singapore-2027-04-09', 'ADEX 2025', 'https://www.adex.asia/main/wp-content/uploads/2025/09/6-2.jpg'],
      ['positive-ageing-summit-adelaide-2027-05-01', 'Positive Ageing 2026', 'https://storage.entegy.io/'],
      ['ifra-jakarta-2026-08-28', 'IFRA 2025', 'https://ifraexpo.s3.ap-southeast-1.amazonaws.com/'],
      ['spiel-essen-2026-10-22', 'SPIEL 2025', 'https://www.spiel-essen.de/images/galerien/2025/'],
      ['metal-and-weld-ho-chi-minh-2026-11-25', 'METAL&WELD 2024', 'https://metalweld.vn/Uploads/files/'],
    ];
    const urls = new Map(getHeroRegistryEntries().map((entry) => [entry.imageUrl, entry.slug]));
    for (const [slug, label, url] of migrated) {
      const image = getRegisteredHeroImage(slug);
      expect(image?.previousEditionLabel, slug).toBe(label);
      expect(image!.url.startsWith(url), slug).toBe(true);
      // Not shared: no other registry entry uses the same photo.
      expect(urls.get(image!.url), slug).toBe(slug);
    }
  });

  it('adds the reviewed registry-queue batch-1 photos, labelled with the edition the page or photo names', () => {
    const batch1: [slug: string, label: string, url: string, width: number, height: number][] = [
      ['veterantechna-brno-brno-2026-10-17', 'VeteranTechna Brno 2025', 'https://www.veterantechna.cz/wp-content/uploads/2025/11/2025-10-veterantechna-hryciow_DSC6788D.jpg', 1280, 850],
      ['electricity-transformation-canada-toronto-on-2026-10-19', 'ETC 2025', 'https://electricity-transformation.ca/wp-content/uploads/2025/11/DSC04450.jpg', 2500, 1667],
      ['vinitaly-usa-wine2wine-business-forum-new-york-ny-2026-10-26', 'wine2wine 2025', 'https://www.vinitaly.com/media/dkectpy1/wine2wine_2025_0002.jpg?width=1200&height=700&rnd=134145836905670000', 1200, 700],
      ['lucca-comics-and-games-lucca-2026-10-28', 'Lucca Comics 2022', 'https://www.luccacomicsandgames.com/wp-content/uploads/2025/05/2022-10-31_Tim-Burton-@-Lucca-Comics-Games_Cosplayer-Gathering_-4153-2.jpg', 1200, 800],
    ];
    const urls = new Map(getHeroRegistryEntries().map((entry) => [entry.imageUrl, entry.slug]));
    for (const [slug, label, url, width, height] of batch1) {
      expect(getRegisteredHeroImage(slug), slug).toEqual({ url, width, height, previousEditionLabel: label });
      const entry = getHeroRegistryEntries().find((candidate) => candidate.slug === slug)!;
      expect(entry.previousEdition, slug).toBe(true);
      expect(label.endsWith(String(entry.editionYear)), slug).toBe(true);
      expect(entry.editionYear, slug).toBeLessThan(Number(entry.catalogStartDate.slice(0, 4)));
      expect(urls.get(url), slug).toBe(slug);
      expect(isDeniedHeroImage(url), slug).toBe(false);
    }
  });

  it('gives MIG the 2025 Veneto-stand photo, not the batch-1 photos the banner crop ruled out', () => {
    const slug = 'mig-mostra-internazionale-del-gelato-artigianale-longarone-2026-11-01';
    const url = 'https://www.mostradelgelato.com/wp-content/uploads/2025/12/02.jpg';
    expect(getRegisteredHeroImage(slug)).toEqual({ url, width: 2048, height: 1536, previousEditionLabel: 'MIG 2025' });
    const entry = getHeroRegistryEntries().find((candidate) => candidate.slug === slug)!;
    expect(entry).toMatchObject({ editionYear: 2025, previousEdition: true, catalogStartDate: '2026-11-01' });
    // The edition comes from the article the gallery sits in; the photo itself has no caption or alt text.
    expect(entry.sourcePageUrl).toBe('https://www.mostradelgelato.com/il-gelato-con-le-dop-e-igp-del-veneto-fanno-experience-e-conquistano-il-giappone/');
    expect(entry.attribution).toContain('A MIG Experience 2025, dal 30 di novembre al 2 dicembre');
    expect(entry.attribution).toContain('three-image gallery');
    expect(entry.attribution).toContain('no caption or alt text');
    expect(isDeniedHeroImage(url)).toBe(false);
    expect(getHeroRegistryEntries().filter((candidate) => candidate.imageUrl === url)).toHaveLength(1);
    // 95b and 95c: verified 2025, but the desktop crop showed only backs of heads or cut faces.
    for (const heldUrl of [
      'https://i0.wp.com/www.mostradelgelato.com/wp-content/uploads/2025/12/Confartigianato-a-MIG-Experience-2025_02.jpg?w=2500&ssl=1',
      'https://i0.wp.com/www.mostradelgelato.com/wp-content/uploads/2025/12/Gelato-del-Benessere-inaugurazione.jpg?w=2500&ssl=1',
    ]) {
      expect(getHeroRegistryEntries().some((candidate) => candidate.imageUrl === heldUrl), heldUrl).toBe(false);
    }
  });

  it('gives Kosmima the 2025 award-winners photo, not the line-up whose faces the banner crop cut off', () => {
    const slug = 'kosmima-thessaloniki-2026-10-17';
    const url =
      'https://www.kosmima-expo.gr/wp-content/uploads/2025/10/%CE%92%CE%A1%CE%91%CE%92%CE%95%CE%A5%CE%98%CE%95%CE%9D%CE%A4%CE%95%CE%A3-%CE%94%CE%99%CE%91%CE%93%CE%A9%CE%9D%CE%99%CE%A3%CE%9C%CE%9F%CE%A5-%CE%A6%CE%99%CE%9B%CE%9F%CE%A4%CE%95%CE%A7%CE%9D%CE%97%CE%A3%CE%97%CE%A3-%CE%9A%CE%9F%CE%A3%CE%9C%CE%97%CE%9C%CE%91%CE%A4%CE%9F%CE%A3.jpeg';
    // Percent-encoded, so the Greek file name survives every client unchanged.
    expect(decodeURIComponent(url).endsWith('ΒΡΑΒΕΥΘΕΝΤΕΣ-ΔΙΑΓΩΝΙΣΜΟΥ-ΦΙΛΟΤΕΧΝΗΣΗΣ-ΚΟΣΜΗΜΑΤΟΣ.jpeg')).toBe(true);
    expect(getRegisteredHeroImage(slug)).toEqual({ url, width: 1599, height: 994, previousEditionLabel: 'Kosmima 2025' });
    const entry = getHeroRegistryEntries().find((candidate) => candidate.slug === slug)!;
    expect(entry).toMatchObject({ editionYear: 2025, previousEdition: true, catalogStartDate: '2026-10-17' });
    // The year comes from the article the photo sits in (primary) and the show's recap (corroboration).
    expect(entry.sourcePageUrl).toBe('https://www.kosmima-expo.gr/press-2025-10-20/');
    expect(entry.attribution).toContain('published 20 October 2025');
    expect(entry.attribution).toContain('https://www.kosmima-expo.gr/press-2025-10-22/');
    expect(entry.attribution).toContain('no caption or alt text');
    expect(isDeniedHeroImage(url)).toBe(false);
    expect(getHeroRegistryEntries().filter((candidate) => candidate.imageUrl === url)).toHaveLength(1);
    // 22c: verified 2025, but the desktop crop showed a row of headless suits.
    expect(getHeroRegistryEntries().some((candidate) => candidate.imageUrl === 'https://www.kosmima-expo.gr/wp-content/uploads/2025/10/KOSMIMA-2.jpg')).toBe(false);
  });

  it('adds the batch-1 site-search photos, each dated by its page and labelled with that edition', () => {
    const added: [slug: string, label: string, url: string, width: number, height: number, source: string][] = [
      ['maden-tek-mining-tech-ankara-2026-10-22', 'Maden-Tek 2024', 'https://www.maden-tek.com/wp-content/uploads/2025/10/WhatsApp-Image-2024-12-16-at-11.40.54.jpeg', 4000, 2252, 'https://www.maden-tek.com/2-maden-tek-2024/'],
      ['miapex-malaysia-international-autoparts-expo-kuala-lumpur-2026-10-23', 'MIAPEX 2024', 'https://malaysiaautopartsexpo.com/wp-content/uploads/2025/02/WhatsApp-Image-2024-12-15-at-11.20.16-AM.jpeg', 2560, 1920, 'https://malaysiaautopartsexpo.com/miapex-photo-video-gallery/'],
      ['process-technology-gothenburg-2026-10-20', 'ProcessTeknik 2024', 'https://en.processteknik.info/uploads/sites/58/2024/11/emmy_241009_0004_WEBB.jpg', 2500, 1667, 'https://en.processteknik.info/for-press/'],
      ['dkm-konzepte-and-losungen-dortmund-2026-10-27', 'DKM 2024', 'https://die-leitmesse.de/wp-content/uploads/2024-die-Leitmesse-Dortmund-Messeimpressionen-9.webp', 1980, 1321, 'https://die-leitmesse.de/neuigkeiten/ruckblick-dkm-2024'],
      ['dolci-d-italia-spoleto-2026-10-30', "Dolci d'Italia 2024", 'https://www.dolciditalia.it/wp-content/uploads/2024/12/dolci-ditalia2-2024-5.webp', 1603, 1067, 'https://www.dolciditalia.it/fotogallery-2024/'],
      ['international-prague-car-festival-prague-2026-10-31', 'Prague Car Festival 2025', 'https://praguecarfestival.cz/wp-content/uploads/2025/11/LS8_7299.jpg', 1500, 1000, 'https://praguecarfestival.cz/prague-car-festival-2025-v-detailech/'],
      ['izb-internationale-zuliefererborse-wolfsburg-2026-10-27', 'IZB 2024', 'https://www.izb-online.com/fileadmin/_processed_/7/c/csm_IZB-2024-DSC_2423_61193f55e8.webp', 1920, 1276, 'https://www.izb-online.com/rueckblick-mediathek/impressionen'],
      ['semana-internacional-do-cafe-belo-horizonte-2026-11-01', 'SIC 2025', 'https://semanainternacionaldocafe.com.br/wp-content/uploads/2025/11/20251105LD0035-2048x1365-1.jpg', 2048, 1365, 'https://semanainternacionaldocafe.com.br/producao/transformacao-da-cafeicultura-marca-1o-dia-de-palestras-da-sic-2025/'],
    ];
    for (const [slug, label, url, width, height, source] of added) {
      expect(getRegisteredHeroImage(slug), slug).toEqual({ url, width, height, previousEditionLabel: label });
      const entry = getHeroRegistryEntries().find((candidate) => candidate.slug === slug)!;
      expect(entry.sourcePageUrl, slug).toBe(source);
      // The year on the banner is the one the source page names, and it is before the catalog edition.
      expect(label.endsWith(String(entry.editionYear)), slug).toBe(true);
      expect(entry.attribution, slug).toContain(String(entry.editionYear));
      expect(entry.editionYear, slug).toBeLessThan(Number(entry.catalogStartDate.slice(0, 4)));
      expect(isDeniedHeroImage(url), slug).toBe(false);
      expect(getHeroRegistryEntries().filter((candidate) => candidate.imageUrl === url), slug).toHaveLength(1);
    }
  });

  it('adds the batch-2 site-search photos, each dated by its page or the photo itself', () => {
    const added: [slug: string, label: string, url: string, width: number, height: number, source: string][] = [
      ['saudi-international-medlab-expo-riyadh-2026-10-12', 'Medlab 2022', 'https://i0.wp.com/saudimedlabexpo.com/wp-content/uploads/2022/11/DSC_5243.jpg?w=2560&ssl=1', 2560, 1706, 'https://saudimedlabexpo.com/news/'],
      ['bimox-bangladesh-international-marine-and-offshore-expo-dhaka-2026-10-15', 'BIMOX 2024', 'https://savor-bimox.com/wp-content/uploads/2024/11/WhatsApp-Image-2024-11-14-at-10.29.52-AM.jpeg', 1280, 720, 'https://savor-bimox.com/bimox-photo-gallery-2024/'],
      ['taitronics-taipei-international-electronics-show-taipei-2026-10-20', 'TAITRONICS 2023', 'https://storage.googleapis.com/www.taiwantradeshow.com.tw/activity-photo/202311/T-47228641.jpg', 3624, 2324, 'https://www.taitronics.tw/en/album/index.html'],
      ['interbuildexpo-kiev-2026-10-21', 'InterBuildExpo 2021', 'https://www.buildexpo.kiev.ua/wp-content/uploads/2021/03/build_fest_1.jpg', 2048, 1324, 'https://www.buildexpo.kiev.ua/en/news/'],
      ['vietstock-expo-and-forum-ho-chi-minh-2026-10-21', 'Vietstock 2025', 'https://www.vietstock.org/wp-content/uploads/2025/10/z7095623570462_706d1bcc1ac1555df8bd7620342ef2db.jpg', 2560, 1707, 'https://www.vietstock.org/'],
      ['salon-look-internacional-madrid-2026-10-30', 'Salón Look 2024', 'https://www.ifema.es/look/img/s/stand/img-5.webp', 1200, 800, 'https://www.ifema.es/en/look/previous-edition'],
      ['the-smoky-mountain-gift-show-gatlinburg-tn-2026-11-04', 'Smoky Mountain 2025', 'https://cdn.asp.events/CLIENT_CL_US_323E7AA7_5056_B733_8303D39C538813E0/sites/smgs2025/media/2026/1168-PWP_Smoky-Mountain-Gift-Show.jpg', 1500, 1000, 'https://www.smokymtngiftshow.com/exhibit'],
      ['qatar-boat-show-doha-2026-11-04', 'Qatar Boat Show 2025', 'https://boatshowqatar.com/wp-content/uploads/2026/01/DJI_20251108193005_0016_D.jpg', 1200, 900, 'https://boatshowqatar.com/2025-show-recap/'],
    ];
    for (const [slug, label, url, width, height, source] of added) {
      expect(getRegisteredHeroImage(slug), slug).toEqual({ url, width, height, previousEditionLabel: label });
      const entry = getHeroRegistryEntries().find((candidate) => candidate.slug === slug)!;
      expect(entry.sourcePageUrl, slug).toBe(source);
      expect(label.endsWith(String(entry.editionYear)), slug).toBe(true);
      expect(entry.attribution, slug).toContain(String(entry.editionYear));
      expect(entry.editionYear, slug).toBeLessThan(Number(entry.catalogStartDate.slice(0, 4)));
      expect(isDeniedHeroImage(url), slug).toBe(false);
      expect(getHeroRegistryEntries().filter((candidate) => candidate.imageUrl === url), slug).toHaveLength(1);
    }
    // TAITRONICS: the album card and the photo both say 2023, not the neighbouring 2024 card.
    expect(getRegisteredHeroImage('taitronics-taipei-international-electronics-show-taipei-2026-10-20')?.previousEditionLabel).toBe('TAITRONICS 2023');
  });

  it('adds the batch-3 site-search photos, each dated by its gallery heading, caption or alt text', () => {
    const added: [slug: string, label: string, url: string, width: number, height: number, source: string][] = [
      ['advanced-engineering-birmingham-birmingham-2026-11-04', 'Adv Engineering 2025', 'https://easyfairsassets.com/sites/401/2026/04/AE_Weds_00924.jpg', 1920, 1280, 'https://www.advancedengineeringuk.com/image-library/'],
      ['arbeitsschutz-aktuell-stuttgart-2026-11-05', 'Arbeitsschutz Aktuell 2024', 'https://arbeitsschutz-aktuell.hinte-messe.de/wp-content/uploads/2024/11/DSC5390.jpg', 2000, 1333, 'https://arbeitsschutz-aktuell.hinte-messe.de/aussteller-werden-2026/'],
      ['ambient-ljubljana-furniture-fair-ljubljana-2026-11-05', 'Ambient Ljubljana 2023', 'https://www.ambient-homeplus.si/app/uploads/2023/11/GR-Ambient-Dom-Plus-Ziga_Koren-231108-0297-2048x1365.jpg', 2048, 1365, 'https://www.ambient-homeplus.si/about-the-fair/photogallery-2023/'],
      ['epoqu-auto-lyon-2026-11-06', 'Époqu’Auto 2025', 'https://epoquauto.com/wp-content/uploads/2026/08/ligier.jpg', 2000, 1330, 'https://epoquauto.com/revoir-le-salon-2025/'],
      ['retro-classics-bavaria-nuremberg-2026-11-06', 'Retro Classics Bavaria 2025', 'https://www.retro-classics-bavaria.de/fileadmin/_processed_/5/3/csm_25-11-08-RCB-%40-Uwe-Niklas-0028_2bbe61fc54.jpg', 2600, 1733, 'https://www.retro-classics-bavaria.de/de/aussteller/impressionen'],
      ['therapie-hamburg-hamburg-2026-11-06', 'therapie Hamburg 2024', 'https://www.therapiemesse-hamburg.de/files/therapie-hamburg/media/therapie-master/tpmaster-bilder-events/tpmaster-tph/tpmaster-tph24/auswahl-pressefotos/-dsc1155.jpg', 2500, 1667, 'https://www.therapiemesse-hamburg.de/en/factsheet-en'],
      ['riso-and-confeffi-pordeone-pordenone-2026-11-07', 'Riso & Confetti 2016', 'https://www.risoeconfetti.it/wp-content/uploads/2016/11/Riso-e-Confetti-5_11_16-4.jpg', 1500, 1001, 'https://www.risoeconfetti.it/gallery/'],
      ['antica-namur-namur-2026-11-07', 'Antica Namur 2025', 'https://easyfairsassets.com/sites/332/2025/11/david_plas_18482.jpg', 2048, 1365, 'https://www.antica.be/press/'],
      ['cairo-ict-cairo-2026-11-08', 'Cairo ICT 2025', 'https://cairoict.com/site/photos/cairo-ict-ai-new-era-display-5.jpg', 1600, 1143, 'https://cairoict.com/'],
      ['perth-4wd-and-adventure-show-perth-2026-11-06', 'Perth 4WD Show 2024', 'https://perth.4wdshow.com.au/wp-content/uploads/2024/11/IMG_8217.jpg', 4032, 3024, 'https://perth.4wdshow.com.au/media/photos/2024-photo-gallery/'],
      ['madrid-logistics-and-distribution-madrid-2026-11-11', 'L&A Madrid 2025', 'https://easyfairsassets.com/sites/84/2025/10/EL-16-octubre-598.jpg', 1920, 1280, 'https://www.logisticsautomationmadrid.com/en/home/about-us/photo-gallery-2025/'],
      ['asfw-africa-sourcing-and-fashion-week-addis-addis-ababa-2026-11-12', 'ASFW 2022', 'https://www.asfw-online.com/wp-content/uploads/2022/11/FAS1615.jpg', 1500, 1000, 'https://www.asfw-online.com/news-archive-2022/'],
      ['arte-padova-padua-2026-11-13', 'ArtePadova 2022', 'https://www.artepadova.com/wp-content/uploads/2023/10/IMG_6968-scaled-1.jpg', 2560, 1920, 'https://www.artepadova.com/foto-artepadova/foto-artepadova-2023/'],
    ];
    for (const [slug, label, url, width, height, source] of added) {
      expect(getRegisteredHeroImage(slug), slug).toEqual({ url, width, height, previousEditionLabel: label });
      const entry = getHeroRegistryEntries().find((candidate) => candidate.slug === slug)!;
      expect(entry.sourcePageUrl, slug).toBe(source);
      expect(label.endsWith(String(entry.editionYear)), slug).toBe(true);
      expect(entry.attribution, slug).toContain(String(entry.editionYear));
      expect(entry.editionYear, slug).toBeLessThan(Number(entry.catalogStartDate.slice(0, 4)));
      expect(isDeniedHeroImage(url), slug).toBe(false);
      expect(getHeroRegistryEntries().filter((candidate) => candidate.imageUrl === url), slug).toHaveLength(1);
    }
  });

  it('keeps out batch-3 photos from galleries shared by co-located shows of one organiser', () => {
    // AMI's Plastics World Expos and HELEXPO's Philoxenia/Hotelia galleries cover several catalog shows at once.
    expect(getRegisteredHeroImage('plastics-recycling-world-expo-north-america-cleveland-oh-2026-11-11')).toBeNull();
    expect(getRegisteredHeroImage('hotelia-thessaloniki-2026-11-13')).toBeNull();
  });

  it('adds the batch-4 site-search photos, each dated by its gallery heading, caption, alt text or the photo itself', () => {
    const added: [slug: string, label: string, url: string, width: number, height: number, source: string][] = [
      ['farm-machinery-show-ireland-punchestown-2026-11-17', 'FTMTA Show 2024', 'https://ftmta.ie/wp-content/uploads/2026/07/025-DVR53588-2048x1366.jpg', 2048, 1366, 'https://ftmta.ie/show2024/'],
      ['automotive-meetings-bursa-bursa-2026-11-18', 'Automotive Meetings 2024', 'https://turkey.automotivemeetings.com/images/2024/galerie_2024/4787b9fb-d3a1-46c1-a363-9e7b790617c1.jpg', 2040, 1530, 'https://turkey.automotivemeetings.com/index.php/media-gallery'],
      ['russia-robotics-week-st-petersburg-2026-11-18', 'Robotics Week 2024', 'https://roboticsweek.ru/wp-content/uploads/2024/12/5-1-1.jpg', 1280, 852, 'https://roboticsweek.ru/en/russian-robotics-week-2024'],
      ['datacentres-ireland-dublin-2026-11-18', 'DataCentres 2025', 'https://www.datacentres-ireland.com/wp-content/uploads/sites/102/2025/11/data_Centres_104.jpg', 2700, 1800, 'https://www.datacentres-ireland.com/gallery/'],
      ['industrie-and-maintenance-namur-2026-11-24', 'I&M Namur 2024', 'https://easyfairsassets.com/sites/238/2024/06/53773521293_6bfc2aed5c_k.jpg', 1920, 1280, 'https://www.im-namur.be/fr/'],
      ['adf-congres-paris-2026-11-24', 'ADF 2025', 'https://adfcongres.com/wp-content/uploads/2026/01/Acteon_remsise-DD-2025-2048x1365.jpg', 2048, 1365, 'https://adfcongres.com/acteon-laureat-du-prix-adf-developpement-durable-2025/'],
      ['power-and-energy-ghana-expo-accra-2026-11-25', 'Power & Energy 2022', 'https://www.powerenergyghana.com/images/events/e221%20(4).jpg', 3120, 2080, 'https://www.powerenergyghana.com/edition2022'],
      ['genera-madrid-2026-11-24', 'GENERA 2024', 'https://www.ifema.es/genera/img/m/asi-fue-genera-2024/genera-2024.webp', 1920, 1280, 'https://www.ifema.es/en/genera/previous-edition'],
    ];
    for (const [slug, label, url, width, height, source] of added) {
      expect(getRegisteredHeroImage(slug), slug).toEqual({ url, width, height, previousEditionLabel: label });
      const entry = getHeroRegistryEntries().find((candidate) => candidate.slug === slug)!;
      expect(entry.sourcePageUrl, slug).toBe(source);
      expect(label.endsWith(String(entry.editionYear)), slug).toBe(true);
      expect(entry.attribution, slug).toContain(String(entry.editionYear));
      expect(entry.editionYear, slug).toBeLessThan(Number(entry.catalogStartDate.slice(0, 4)));
      expect(isDeniedHeroImage(url), slug).toBe(false);
      expect(getHeroRegistryEntries().filter((candidate) => candidate.imageUrl === url), slug).toHaveLength(1);
    }
  });

  it('keeps out batch-4 photos whose gallery belongs to another show or whose year conflicts', () => {
    // HEAVENT-captioned galleries (Affaire de Cadeaux, Séminaire Expo), the shared Homelife Indonesia series, and Ob'Art (alt 2025 vs 2024 file).
    for (const slug of ['affaire-de-cadeaux-paris-2026-11-17', 'seminaire-expo-paris-2026-11-17', 'aes-expo-indonesia-jakarta-2026-11-25', 'ob-art-paris-paris-2026-11-20']) {
      expect(getRegisteredHeroImage(slug), slug).toBeNull();
    }
  });

  it('keeps these previous-edition labels short enough that the mobile banner shows the year', () => {
    // The label pill is one truncated line (~301px on a 390px phone); 24 characters fit with the year intact.
    for (const slug of [
      'farm-machinery-show-ireland-punchestown-2026-11-17',
      'automotive-meetings-bursa-bursa-2026-11-18',
      'russia-robotics-week-st-petersburg-2026-11-18',
      'industrie-and-maintenance-namur-2026-11-24',
      'power-and-energy-ghana-expo-accra-2026-11-25',
      'lucca-comics-and-games-lucca-2026-10-28',
      'the-smoky-mountain-gift-show-gatlinburg-tn-2026-11-04',
      'advanced-engineering-birmingham-birmingham-2026-11-04',
      'datacentres-ireland-dublin-2026-11-18',
    ]) {
      const label = getRegisteredHeroImage(slug)?.previousEditionLabel ?? '';
      expect(label.length, slug).toBeLessThanOrEqual(24);
      expect(/\d{4}$/.test(label), slug).toBe(true);
    }
  });

  it('keeps the older previous-edition labels short enough that the mobile banner shows the year', () => {
    // These 18 labels lost their year in the one-line label pill on a 390px phone and were shortened.
    for (const slug of [
      'salon-des-vins-de-loire-angers-2027-02-01',
      'international-cyber-expo-london-2026-09-29',
      'best-practice-birmingham-birmingham-2026-10-07',
      'saltwater-sportfishing-show-salem-or-2027-02-27',
      'bauen-wohnen-luzern-lucerne-2027-02-26',
      'fruit-attraction-sao-paulo-sao-paulo-2027-04-06',
      'textiles-recycling-expo-usa-charlotte-nc-2027-04-07',
      'european-coatings-show-nuremberg-2027-04-27',
      'beauty-show-krasnodar-krasnodar-2027-05-26',
      'atmosphere-america-summit-2027-06-01',
      'international-police-expo-new-delhi-2027-06-01',
      'for-decor-and-present-prague-2026-09-09',
      'baumesse-bad-kreuznach-bad-kreuznach-2026-10-16',
      'licensing-show-asean-bangkok-2026-11-03',
      'bau-energie-messe-bern-2026-11-05',
      'logistics-and-automation-madrid-madrid-2026-11-11',
      'hauslbauermesse-klagenfurt-klagenfurt-2027-02-19',
      'positive-ageing-summit-adelaide-2027-05-01',
    ]) {
      const entry = getHeroRegistryEntries().find((candidate) => candidate.slug === slug)!;
      expect(entry.editionLabel.length, slug).toBeLessThanOrEqual(24);
      expect(entry.editionLabel.endsWith(String(entry.editionYear)), slug).toBe(true);
    }
  });

  it('adds the batch-5a site-search photos, each dated by its page or the photo itself', () => {
    const added: [slug: string, label: string, url: string, width: number, height: number, source: string][] = [
      ['bevmx-bangladesh-electric-vehicle-and-mobility-exhibition-dhaka-2026-11-26', 'BEVMX 2024', 'https://savor-bevmx.com/wp-content/uploads/2024/11/MAS5013-2048x1365.jpg', 2048, 1365, 'https://savor-bevmx.com/bevmx-photo-gallery-2024/'],
      ['therapy-expo-birmingham-2026-11-25', 'Therapy Expo 2025', 'https://cdn.asp.events/CLIENT_CloserSt_D86EA381_5056_B739_5482D50A1A831DDD/sites/therapy-expo-2026/media/DSC_2005.jpg', 3000, 2000, 'https://www.therapyshow.co.uk/'],
      ['thailand-international-mega-fair-riyadh-2026-12-01', 'Thailand Mega Fair 2024', 'https://www.indexcreativevillage.com/wp-content/uploads/2024/12/LINE_ALBUM_ICVEX-Saudi_241120_15.jpg', 2048, 1367, 'https://www.indexcreativevillage.com/thailand-international-mega-fair-2024-riyadh/'],
      ['biofit-marseille-2026-12-10', 'BioFIT 2025', 'https://www.biofit-event.com/wp-content/uploads/2026/02/ZONE-EXPO-2048x1536.jpeg', 2048, 1536, 'https://www.biofit-event.com/previous-editions/'],
      ['aviation-forum-munich-2026-12-14', 'Aviation Forum 2025', 'https://images.squarespace-cdn.com/content/v1/6425b5b0561e830becddd89d/68bbface-499a-4964-a56f-8b2aea2b7235/IPM_Aviation-Forum_Hamburg_Tag-II-0025.jpg?format=2500w', 2500, 1667, 'https://www.aviation-forum.com/'],
      ['the-london-international-horse-show-london-2026-12-17', 'London Horse Show 2025', 'https://b4483412.assetcdn.net/2.0/4483412/wp-content/uploads/horsebreed1-1536x1024.jpg?lossy=2&strip=1&webp=1', 1536, 1024, 'https://londonhorseshow.com/news/common-horse-breeds-explained/'],
    ];
    for (const [slug, label, url, width, height, source] of added) {
      expect(getRegisteredHeroImage(slug), slug).toEqual({ url, width, height, previousEditionLabel: label });
      const entry = getHeroRegistryEntries().find((candidate) => candidate.slug === slug)!;
      expect(entry.sourcePageUrl, slug).toBe(source);
      expect(label.length, slug).toBeLessThanOrEqual(24);
      expect(label.endsWith(String(entry.editionYear)), slug).toBe(true);
      expect(entry.attribution, slug).toContain(String(entry.editionYear));
      expect(entry.editionYear, slug).toBeLessThan(Number(entry.catalogStartDate.slice(0, 4)));
      expect(isDeniedHeroImage(url), slug).toBe(false);
      expect(getHeroRegistryEntries().filter((candidate) => candidate.imageUrl === url), slug).toHaveLength(1);
    }
  });

  it('leaves out the batch-1 photos that were held, unverified or rejected in review', () => {
    for (const slug of [
      // Verified 2025 but on hold: a 9.5 MB file on an expiring Salesforce link.
      'telecoms-world-asia-bangkok-2026-10-27',
      // Verified, but the 3.5:1 centre crop of the desktop banner crops out the
      // show's banner, leaving a bare facade.
      'solids-antwerp-antwerp-2026-10-21',
      // Edition year only in a file name or EXIF.
      'fakuma-friedrichshafen-2026-10-12',
      'salon-du-tatouage-de-clermont-ferrand-clermont-ferrand-2026-10-17',
      // The official site contradicts the catalog edition.
      'coach-and-bus-uk-birmingham-2026-11-01',
      // Every candidate rejected (another event, or not a usable banner).
      'upet-beijing-2026-10-16',
    ]) {
      expect(getRegisteredHeroImage(slug), slug).toBeNull();
    }
  });

  it('leaves out the audit candidates whose edition rests only on a file name, URL, page title or promo copy', () => {
    for (const slug of [
      'volta-basel-basel-2027-06-01',
      'snec-hydrogen-and-fuel-cell-shanghai-2026-09-28',
      'espacio-food-service-santiago-2026-09-29',
      'interlook-dortmund-2027-01-16',
      'autocom-brasil-sao-paulo-2027-03-01',
      'jarmark-sw-dominika-gdansk-2027-07-01',
      // Rejected on crop/content, and images shared between shows.
      'fahrrad-messe-essen-essen-2027-02-25',
      'snec-energy-storage-shanghai-2026-09-28',
    ]) {
      expect(getRegisteredHeroImage(slug), slug).toBeNull();
    }
  });

  it('never lets the automatic resolver show a denylisted or cross-show image', () => {
    const denied = (denylistFile.entries as { imageUrl: string }[])[0].imageUrl;
    expect(isDeniedHeroImage(denied)).toBe(true);
    const claims = createHeroImageClaims();
    const photo = { url: 'https://show.test/hall.jpg', width: 2000, height: 1200 };
    expect(screenAutomaticHeroImage({ ...photo, url: denied }, 'show a', claims)).toBeNull();
    expect(screenAutomaticHeroImage(photo, 'show a', claims)).toEqual(photo);
    expect(screenAutomaticHeroImage(photo, 'show a', claims)).toEqual(photo);
    // Another show resolves to the same photo: neither may use it from now on.
    expect(screenAutomaticHeroImage(photo, 'show b', claims)).toBeNull();
    expect(screenAutomaticHeroImage(photo, 'show a', claims)).toBeNull();
    expect(screenAutomaticHeroImage(null, 'show a', claims)).toBeNull();
  });

  it('keeps denying a signed CDN image after the CDN re-signs its URL', () => {
    // SIDO Lyon's denied product render came back on the live page under a fresh daily
    // signature: the file is the same, only Expires/Signature changed.
    const path = 'https://mobicheckin-assets.eventmaker.io/uploads/events/69b5252a0df821b8901072d4/blog_articles/6a9817dcc6fd13ce94fbfd47/Modular_Sytsem_Grafik_Presse.jpg';
    const denied = (denylistFile.entries as { imageUrl: string }[]).find((entry) => entry.imageUrl.startsWith(path + '?'))!;
    expect(denied).toBeDefined();
    expect(isDeniedHeroImage(denied.imageUrl)).toBe(true);
    expect(isDeniedHeroImage(`${path}?Expires=1855007999&Signature=fresh-signature&Key-Pair-Id=K901T7O9PELQE`)).toBe(true);
    expect(isDeniedHeroImage(`${path}?X-Amz-Date=20261012T000000Z&X-Amz-Signature=abc`)).toBe(true);
    // A different file on the same CDN, and a query that picks a different image, stay allowed.
    expect(isDeniedHeroImage(path.replace('Modular_Sytsem_Grafik_Presse', 'Hall_overview'))).toBe(false);
    expect(isDeniedHeroImage(`${path}?versionId=2`)).toBe(false);
  });

  it('denies the Mondial de l’Auto brand product image the resolver fell through to', () => {
    expect(isDeniedHeroImage('https://mondial.paris/wp-content/uploads/salons-pms/2026/10/Deepal_Model_page_1824x2156_SKD_1_c907a9137f-e1791367234724.png')).toBe(true);
    expect(isDeniedHeroImage('https://mondial.paris/wp-content/uploads/salons-pms/2026/10/Aito-Paris-Motor-Show.png')).toBe(true);
  });

  it('keeps every denylist entry a valid URL with a recorded reason, and no registry photo on it', () => {
    const entries = denylistFile.entries as { imageUrl: string; reason: string }[];
    expect(entries.length).toBeGreaterThan(500);
    for (const entry of entries) {
      expect(() => new URL(entry.imageUrl)).not.toThrow();
      expect(entry.reason.trim().length, entry.imageUrl).toBeGreaterThan(10);
    }
    for (const entry of getHeroRegistryEntries()) expect(isDeniedHeroImage(entry.imageUrl), entry.slug).toBe(false);
  });

  it('keeps ASEW out until its mobile title overlap is solved', () => {
    expect(getRegisteredHeroImage('asia-sustainable-energy-week-bangkok-2027-07-07')).toBeNull();
  });

  it('accepts a well-formed previous-edition or current-edition entry', () => {
    expect(registryEntryProblem(VALID)).toBeNull();
    expect(registryEntryProblem({ ...VALID, editionYear: 2027, previousEdition: false, editionLabel: '' })).toBeNull();
  });

  it('rejects entries that would put an unverified, unlabelled or unsuitable photo on a page', () => {
    const bad: [string, Partial<HeroRegistryEntry>][] = [
      ['pending review', { status: 'needs_review' as 'verified' }],
      ['no evidence', { attribution: '  ' }],
      ['too narrow', { width: 1000 }],
      ['too square', { width: 1300, height: 1200 }],
      ['too wide', { width: 4000, height: 900 }],
      ['plain http image', { imageUrl: 'http://example.com/a.jpg' }],
      ['private host', { imageUrl: 'https://localhost/a.jpg' }],
      ['previous edition with no year in its label', { editionLabel: 'Test Expo' }],
      ['previous edition dated in the catalog year', { editionYear: 2027 }],
      ['photo dated after the edition', { editionYear: 2028, previousEdition: false }],
      ['older photo presented as current', { previousEdition: false }],
    ];
    for (const [why, change] of bad) {
      expect(registryEntryProblem({ ...VALID, ...change }), why).not.toBeNull();
    }
  });
});
