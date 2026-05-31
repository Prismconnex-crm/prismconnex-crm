import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
const result = execSync('node scripts/import-eventseye-country.mjs --listingUrl "https://www.eventseye.com/fairs/c1_trade-shows_uk-united-kingdom.html" --country "United Kingdom" --years "2025,2026,2027" --preview', {encoding: 'utf8', maxBuffer: 1024*1024*10});
const parsed = JSON.parse(result.trim());
writeFileSync('test_summary.json', JSON.stringify(parsed.summary, null, 2), 'utf8');
