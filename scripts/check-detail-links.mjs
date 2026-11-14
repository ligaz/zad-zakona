/**
 * Проверка за висящи връзки към детайлни страници.
 *
 * Инцидент 11.2026 (седмична проверка 01.11.2026, ДВ 99/2026): `apply-act-details.mjs`
 * записа `detailId = "act-<id>"` в acts-index.json за 166945 (ЗУО) и 167533 (ЗОБВПИ),
 * но курираните записи не бяха merge-нати в amendments.json → картичките в /aktove
 * водеха към /promeni/act-<id>, която не се генерира (generateStaticParams чете само
 * amendments.json) → 404.
 *
 * Проверява:
 *   1. всеки `detailId` в acts-index.json има запис в amendments.json;
 *   2. всеки amendment има `lawId`, който съществува в laws.json;
 *   3. всеки `act-*` amendment е включен в `amendments` на своя закон.
 *
 * Употреба: node scripts/check-detail-links.mjs   (exit 1 при проблем)
 * Пуска се автоматично преди `npm run build` (prebuild).
 */
import { readFileSync } from "node:fs";

const idx = JSON.parse(readFileSync("data/acts-index.json", "utf8"));
const amendments = JSON.parse(readFileSync("data/amendments.json", "utf8"));
const laws = JSON.parse(readFileSync("data/laws.json", "utf8"));

const amendIds = new Set(amendments.map((a) => a.id));
const lawById = new Map(laws.map((l) => [l.id, l]));
const errors = [];

for (const x of idx) {
  if (x.detailId && !amendIds.has(x.detailId)) {
    errors.push(`${x.id}: detailId „${x.detailId}“ няма запис в amendments.json → /promeni/${x.detailId} е 404`);
  }
}
for (const a of amendments) {
  const law = lawById.get(a.lawId);
  if (!law) {
    errors.push(`${a.id}: lawId „${a.lawId}“ липсва в laws.json`);
    continue;
  }
  if (a.id.startsWith("act-") && !(law.amendments || []).includes(a.id)) {
    errors.push(`${a.id}: не е включен в laws.${a.lawId}.amendments`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} висящи връзки:`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error("Поправка: merge на курираното (merge-curated.mjs / merge-decisions.mjs) или махни detailId.");
  process.exit(1);
}
console.log(`✓ detail links: ${idx.filter((x) => x.detailId).length} detailId, ${amendments.length} amendments — всички вързани.`);
