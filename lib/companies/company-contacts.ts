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
// 2026-11-23 batch of 26 (owner's order).
import irisEducation from "@/data/company-contacts/iris.co.uk.json";
import ixl from "@/data/company-contacts/ixl.com.json";
import jamf from "@/data/company-contacts/jamf.com.json";
import jpik from "@/data/company-contacts/jpik.com.json";
import kahoot from "@/data/company-contacts/kahoot.com.json";
import kami from "@/data/company-contacts/kamiapp.com.json";
import kidsCover from "@/data/company-contacts/kidscover.eu.json";
import lapSafe from "@/data/company-contacts/lapsafe.com.json";
import lightspeed from "@/data/company-contacts/lightspeedsystems.com.json";
import littleGreenButton from "@/data/company-contacts/littlegreenbutton.com.json";
import locker from "@/data/company-contacts/locker.co.uk.json";
import locknCharge from "@/data/company-contacts/lockncharge.com.json";
import logiBrothers from "@/data/company-contacts/logibros.com.json";
import loudwater from "@/data/company-contacts/loudwater.io.json";
import lynxNetworks from "@/data/company-contacts/lynxnetworks.co.uk.json";
import lyreco from "@/data/company-contacts/why.lyreco.com.json";
import madlen from "@/data/company-contacts/madlen.io.json";
import markus from "@/data/company-contacts/markus.tech.json";
import mooka from "@/data/company-contacts/mooka.ie.json";
import mozaik from "@/data/company-contacts/mozaweb.com.json";
import mps from "@/data/company-contacts/mpsuk.net.json";
import mrsWordsmith from "@/data/company-contacts/mrswordsmith.com.json";
import netCtrl from "@/data/company-contacts/net-ctrl.co.uk.json";
import netSupport from "@/data/company-contacts/netsupportsoftware.com.json";
import netsweeper from "@/data/company-contacts/netsweeper.com.json";
import nutKase from "@/data/company-contacts/nutkase.json";
// 2026-11-23 six companies split from All_6_Companies_Contacts.csv (--only-company each).
import okulyo from "@/data/company-contacts/okulyo.com.json";
import omadaTpLink from "@/data/company-contacts/tp-link.com.json";
import openLms from "@/data/company-contacts/openlms.net.json";
import padlet from "@/data/company-contacts/padlet.com.json";
import paperly from "@/data/company-contacts/paperly.education.json";
import parentPay from "@/data/company-contacts/parentpay.com.json";
// 2026-11-23 from all8companies.csv (--only-company each). "Prowise Solutions Inc" rows
// NOT imported: a US/Indian IT-staffing firm, not the Prowise (prowise.com) exhibitor.
import pearltrees from "@/data/company-contacts/pearltrees.com.json";
import phlowAcademy from "@/data/company-contacts/phlow.academy.json";
import phoneLocker from "@/data/company-contacts/phonelocker.com.json";
import redboxVr from "@/data/company-contacts/redboxvr.com.json";
import revoducate from "@/data/company-contacts/revoducate.matrixlms.com.json";
// 2026-11-24 from company_contacts.xlsx (--only-company each). "Purple" rows NOT imported
// (Purple Innovation, US mattress retailer — not the Purple WiFi exhibitor). PWD Supplies kept
// to its 23 UK rows; 42 government Public Works Department ("PWD") rows excluded.
import pasco from "@/data/company-contacts/pasco.com.json";
import pwdSupplies from "@/data/company-contacts/pwdsupplies.co.uk.json";
import robopack from "@/data/company-contacts/robopack.com.json";
import schoolAi from "@/data/company-contacts/schoolai.com.json";
import schoolBusNet from "@/data/company-contacts/schoolbusnet.eu.json";
import schoolsBroadband from "@/data/company-contacts/schoolsbroadband.co.uk.json";
import screenBeam from "@/data/company-contacts/screenbeam.com.json";
// 2026-11-24 from new_contacts_only.xlsx (--only-company each; Securly also
// --keep-blank-company for Portia Hines, whose row has Company "-" amid Securly rows).
import securly from "@/data/company-contacts/securly.com.json";
import seesaw from "@/data/company-contacts/seesaw.com.json";
import sendient from "@/data/company-contacts/sendient.ai.json";
import signInApp from "@/data/company-contacts/signinapp.com.json";
import simplyhealth from "@/data/company-contacts/simplyhealth.json";
import skolaris from "@/data/company-contacts/skolaris.net.json";
import skolon from "@/data/company-contacts/skolon.com.json";
import surpass from "@/data/company-contacts/surpass.com.json";
import switch4Schools from "@/data/company-contacts/switch4schools.com.au.json";
import switchshop from "@/data/company-contacts/switchshop.co.uk.json";
// 2026-11-24 from Teachers_Talk_Radio_TET_Education_Space_Toddle_TOP_Marks_Contacts.xlsx.
// TET kept to its 43 UK rows; "TOP Marks" rows (window cleaner, electrician…) NOT imported.
import teachersTalkRadio from "@/data/company-contacts/teacherstalkradio.json";
import tet from "@/data/company-contacts/tet.co.uk.json";
import educationSpace from "@/data/company-contacts/theeducationspace.co.uk.json";
import toddle from "@/data/company-contacts/toddleapp.com.json";
// 2026-11-25 from Company_People_Contacts.xlsx (--only-company each). TTS and WIRIS pruned of
// unrelated overseas rows. TOPIQ's requested number (+1-800-874-6253) is Trimble's BETT phone —
// not applied pending the owner's confirmation.
import topiq from "@/data/company-contacts/topiq.json";
import trimble from "@/data/company-contacts/sketchup.trimble.com.json";
import truScholar from "@/data/company-contacts/truscholar.io.json";
import tts from "@/data/company-contacts/tts-group.co.uk.json";
import ubiquiti from "@/data/company-contacts/ui.com.json";
import vapeGuardian from "@/data/company-contacts/vapeguardian.com.json";
import venturEd from "@/data/company-contacts/venturedsolutions.com.json";
import verkada from "@/data/company-contacts/verkada.com.json";
import veryPc from "@/data/company-contacts/very-pc.co.uk.json";
import wiris from "@/data/company-contacts/wiris.com.json";
// 2026-11-25 from ZAGG_Zioxi_Contacts.xlsx (--only-company each; Zioxi minus one Egypt outlier).
import zagg from "@/data/company-contacts/zagg.com.json";
import zioxi from "@/data/company-contacts/zioxi.com.json";
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
  /**
   * Provider-reported availability when the value itself was not revealed
   * (Prospeo: VERIFIED / UNAVAILABLE). Lets the table say "Not revealed"
   * instead of "-" for a verified email or mobile that exists but is not shown.
   */
  emailStatus?: string | null;
  mobileStatus?: string | null;
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
  // 2026-11-23 batch. Imported with --only-company: netsupport/netsweeper/nutkase
  // (combined files). MPS: Tom Critchley's shifted row hand-realigned.
  [irisEducation.domain]: irisEducation as ContactFile,
  [ixl.domain]: ixl as ContactFile,
  [jamf.domain]: jamf as ContactFile,
  [jpik.domain]: jpik as ContactFile,
  [kahoot.domain]: kahoot as ContactFile,
  [kami.domain]: kami as ContactFile,
  [kidsCover.domain]: kidsCover as ContactFile,
  [lapSafe.domain]: lapSafe as ContactFile,
  [lightspeed.domain]: lightspeed as ContactFile,
  [littleGreenButton.domain]: littleGreenButton as ContactFile,
  [locker.domain]: locker as ContactFile,
  [locknCharge.domain]: locknCharge as ContactFile,
  [logiBrothers.domain]: logiBrothers as ContactFile,
  [loudwater.domain]: loudwater as ContactFile,
  [lynxNetworks.domain]: lynxNetworks as ContactFile,
  [lyreco.domain]: lyreco as ContactFile,
  [madlen.domain]: madlen as ContactFile,
  [markus.domain]: markus as ContactFile,
  [mooka.domain]: mooka as ContactFile,
  [mozaik.domain]: mozaik as ContactFile,
  [mps.domain]: mps as ContactFile,
  [mrsWordsmith.domain]: mrsWordsmith as ContactFile,
  [netCtrl.domain]: netCtrl as ContactFile,
  [netSupport.domain]: netSupport as ContactFile,
  [netsweeper.domain]: netsweeper as ContactFile,
  [nutKase.domain]: nutKase as ContactFile,
  [okulyo.domain]: okulyo as ContactFile,
  [omadaTpLink.domain]: omadaTpLink as ContactFile,
  [openLms.domain]: openLms as ContactFile,
  [padlet.domain]: padlet as ContactFile,
  [paperly.domain]: paperly as ContactFile,
  [parentPay.domain]: parentPay as ContactFile,
  [pearltrees.domain]: pearltrees as ContactFile,
  [phlowAcademy.domain]: phlowAcademy as ContactFile,
  [phoneLocker.domain]: phoneLocker as ContactFile,
  [redboxVr.domain]: redboxVr as ContactFile,
  [revoducate.domain]: revoducate as ContactFile,
  [pasco.domain]: pasco as ContactFile,
  [pwdSupplies.domain]: pwdSupplies as ContactFile,
  [robopack.domain]: robopack as ContactFile,
  [schoolAi.domain]: schoolAi as ContactFile,
  [schoolBusNet.domain]: schoolBusNet as ContactFile,
  [schoolsBroadband.domain]: schoolsBroadband as ContactFile,
  [screenBeam.domain]: screenBeam as ContactFile,
  [securly.domain]: securly as ContactFile,
  [seesaw.domain]: seesaw as ContactFile,
  [sendient.domain]: sendient as ContactFile,
  [signInApp.domain]: signInApp as ContactFile,
  [simplyhealth.domain]: simplyhealth as ContactFile,
  [skolaris.domain]: skolaris as ContactFile,
  [skolon.domain]: skolon as ContactFile,
  [surpass.domain]: surpass as ContactFile,
  [switch4Schools.domain]: switch4Schools as ContactFile,
  [switchshop.domain]: switchshop as ContactFile,
  [teachersTalkRadio.domain]: teachersTalkRadio as ContactFile,
  [tet.domain]: tet as ContactFile,
  [educationSpace.domain]: educationSpace as ContactFile,
  [toddle.domain]: toddle as ContactFile,
  [topiq.domain]: topiq as ContactFile,
  [trimble.domain]: trimble as ContactFile,
  [truScholar.domain]: truScholar as ContactFile,
  [tts.domain]: tts as ContactFile,
  [ubiquiti.domain]: ubiquiti as ContactFile,
  [vapeGuardian.domain]: vapeGuardian as ContactFile,
  [venturEd.domain]: venturEd as ContactFile,
  [verkada.domain]: verkada as ContactFile,
  [veryPc.domain]: veryPc as ContactFile,
  [wiris.domain]: wiris as ContactFile,
  [zagg.domain]: zagg as ContactFile,
  [zioxi.domain]: zioxi as ContactFile,
};

/**
 * Companies whose paper-plane button opens the app's existing email workflow
 * (a mailto: link, as the Email column and exhibitor contact card use) for
 * contacts that have a real email. Nothing is sent automatically; contacts
 * without an email keep the inert button.
 */
const PAPER_PLANE_MAILTO = new Set([
  "briskteaching.com",
  "iris.co.uk",
  // 2026-11-24 company_contacts.xlsx batch.
  "pasco.com",
  "pwdsupplies.co.uk",
  "robopack.com",
  "schoolai.com",
  "schoolbusnet.eu",
  "schoolsbroadband.co.uk",
  "screenbeam.com",
  // 2026-11-24 new_contacts_only.xlsx batch.
  "securly.com",
  "seesaw.com",
  "sendient.ai",
  "signinapp.com",
  "simplyhealth",
  "skolaris.net",
  "skolon.com",
  "surpass.com",
  "switch4schools.com.au",
  "switchshop.co.uk",
  // 2026-11-24 five-company workbook.
  "teacherstalkradio",
  "tet.co.uk",
  "theeducationspace.co.uk",
  "toddleapp.com",
  // 2026-11-25 Company_People_Contacts.xlsx.
  "topiq",
  "sketchup.trimble.com",
  "truscholar.io",
  "tts-group.co.uk",
  "ui.com",
  "vapeguardian.com",
  "venturedsolutions.com",
  "verkada.com",
  "very-pc.co.uk",
  "wiris.com",
  // 2026-11-25 ZAGG_Zioxi_Contacts.xlsx.
  "zagg.com",
  "zioxi.com",
]);

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
  // 2026-11-23 batch — owner-supplied (also stored via --mobile). Jamf, LapSafe and
  // MPS differ by a digit from their BETT directory phones (flagged to the owner).
  "iris.co.uk": "44 344 815 5555",
  "ixl.com": "1 855 255-8800",
  "jamf.com": "44 20 4572 655",
  "jpik.com": "351 229 993 900",
  "kidscover.eu": "31 70 820 1040",
  "lapsafe.com": "44 1787 226 16",
  "lightspeedsystems.com": "44 20 4534 5200",
  "littlegreenbutton.com": "44 1263 888365",
  "locker.co.uk": "44 844 549 9500",
  "lockncharge.com": "44 208 441 4107",
  "lynxnetworks.co.uk": "44 1908 633833",
  "why.lyreco.com": "44 8000 85 85 85",
  "madlen.io": "90 545 542 0511",
  "mooka.ie": "353 74 970 6715",
  "mpsuk.net": "44 800 999 6066",
  "mrswordsmith.com": "44 303 123 1113",
  "net-ctrl.co.uk": "44 1473 281 211",
  "netsupportsoftware.com": "44 1778 382270",
  "netsweeper.com": "1 519-772-0889",
  // 2026-11-23 six-company CSV — owner-supplied, match the BETT directory phones.
  "okulyo.com": "+90 850 307 7242",
  "tp-link.com": "+44 345 147 0017",
  "paperly.education": "+61 1300 472 737",
  // 2026-11-23 all8companies.csv — owner-supplied, match the BETT directory phones.
  "pearltrees.com": "+33 143 489 462",
  "phonelocker.com": "+44 203 161 8121",
  "redboxvr.com": "+44 1253 804802",
  // 2026-11-24 company_contacts.xlsx — owner-supplied, match the BETT directory phones.
  "pasco.com": "1 800-772-8700",
  "pwdsupplies.co.uk": "44 800 999 5683",
  "robopack.com": "45 70 22 11 55",
  "schoolai.com": "1 801-396-0051",
  "schoolbusnet.eu": "30 2109622633",
  "schoolsbroadband.co.uk": "44 1133 222 333",
  "screenbeam.com": "1 800 752 7820",
  // 2026-11-24 new_contacts_only.xlsx — owner-supplied, match the BETT directory phones.
  "securly.com": "44 808 164 9773",
  "seesaw.com": "1 855 673 3729",
  "sendient.ai": "44 1926 811777",
  "signinapp.com": "44 333 016 3551",
  "skolaris.net": "420 777 267 735",
  "surpass.com": "44 1274 203 250",
  "switch4schools.com.au": "61 7 3186 9417",
  "switchshop.co.uk": "44 1438 831870",
  // 2026-11-24 five-company workbook — owner-supplied, match the BETT directory phones.
  "tet.co.uk": "44 20 7553 9950",
  "theeducationspace.co.uk": "44 20 8249 6900",
  // 2026-11-25 Company_People_Contacts.xlsx — owner-supplied, match the BETT directory phones.
  "truscholar.io": "91 84848 13210",
  "tts-group.co.uk": "44 800 138 1370",
  "vapeguardian.com": "44 330 133 0758",
  "venturedsolutions.com": "44 20 7237 8456",
  "verkada.com": "1 650 514-2500",
  "very-pc.co.uk": "44 114 321 8609",
  "wiris.com": "34 932 804 805",
  // 2026-11-25 ZAGG_Zioxi_Contacts.xlsx — owner-supplied, match the BETT directory phones.
  "zagg.com": "+1-800-700-9244",
  "zioxi.com": "44 1844 280123",
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
  // BETT lists NutKase with no website.
  [nameKey("NutKase")]: "nutkase",
  // BETT lists Simplyhealth with no website (only exhibitor of that exact name).
  [nameKey("Simplyhealth")]: "simplyhealth",
  // BETT lists Teachers Talk Radio with no website (only exhibitor of that exact name).
  [nameKey("Teachers Talk Radio")]: "teacherstalkradio",
  // BETT lists TopIQ with no website (only exhibitor of that exact name).
  [nameKey("TopIQ")]: "topiq",
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
  // Prospeo pilot (contacts come from the ExhibitorContact table, not a file).
  "iris.co.uk",
  "ixl.com",
  "jamf.com",
  "jpik.com",
  "kahoot.com",
  "kamiapp.com",
  "kidscover.eu",
  "lapsafe.com",
  "lightspeedsystems.com",
  "littlegreenbutton.com",
  "locker.co.uk",
  "lockncharge.com",
  "logibros.com",
  "loudwater.io",
  "lynxnetworks.co.uk",
  "why.lyreco.com",
  "madlen.io",
  "markus.tech",
  "mooka.ie",
  "mozaweb.com",
  "mpsuk.net",
  "mrswordsmith.com",
  "net-ctrl.co.uk",
  "netsupportsoftware.com",
  "netsweeper.com",
  "nutkase",
  "okulyo.com",
  "tp-link.com",
  "openlms.net",
  "padlet.com",
  "paperly.education",
  "parentpay.com",
  "pearltrees.com",
  "phlow.academy",
  "phonelocker.com",
  "redboxvr.com",
  "revoducate.matrixlms.com",
  "pasco.com",
  "pwdsupplies.co.uk",
  "robopack.com",
  "schoolai.com",
  "schoolbusnet.eu",
  "schoolsbroadband.co.uk",
  "screenbeam.com",
  "securly.com",
  "seesaw.com",
  "sendient.ai",
  "signinapp.com",
  "simplyhealth",
  "skolaris.net",
  "skolon.com",
  "surpass.com",
  "switch4schools.com.au",
  "switchshop.co.uk",
  "teacherstalkradio",
  "tet.co.uk",
  "theeducationspace.co.uk",
  "toddleapp.com",
  "topiq",
  "sketchup.trimble.com",
  "truscholar.io",
  "tts-group.co.uk",
  "ui.com",
  "vapeguardian.com",
  "venturedsolutions.com",
  "verkada.com",
  "very-pc.co.uk",
  "wiris.com",
  "zagg.com",
  "zioxi.com",
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
  directory?: DirectoryContact | null,
  /**
   * Contacts stored elsewhere (e.g. Prospeo imports in the ExhibitorContact
   * table), appended after the file's list. A person already in the file —
   * same LinkedIn profile, else same name — is not added twice.
   */
  extraContacts: CompanyContact[] = []
): CompanyContact[] | null {
  const key = resolveContactKey(domain, directory?.companyName) ?? (extraContacts.length ? domain?.toLowerCase() ?? null : null);
  if (!key) return null;
  const file = CONTACT_FILES[key];
  if (!file && extraContacts.length === 0) return null;
  domain = key;

  const contacts = (file?.contacts ?? []).map((contact) => ({ ...contact }));
  for (const extra of extraContacts) {
    const extraLinkedIn = linkedInKey(extra.personLinkedInUrl);
    const already = contacts.some(
      (contact) =>
        (extraLinkedIn && linkedInKey(contact.personLinkedInUrl) === extraLinkedIn) ||
        nameKey(contact.fullName) === nameKey(extra.fullName)
    );
    if (!already) contacts.push({ ...extra });
  }
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
