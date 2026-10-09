/**
 * Седмична проверка за нови броеве на Държавен вестник.
 *
 * Употреба: npm run check:dv [-- --json]
 *   --json: машинен изход за chaining (нови броеве, липсващи issues,
 *   акти с ДВ без dv_mat) — за подаване към enumerate/resolve скриптовете.
 *
 * ДВ няма публично API — страницата е JSP (dv.parliament.bg/DVWeb).
 * Скриптът е умишлено прост и без зависимости:
 *  1. тегли началната страница на ДВ и търси последните „бр. N/година“;
 *  2. изброява законите в data/laws.json и последното им изменение;
 *  3. принтира чеклист какво да провери човек ръчно.
 *
 * Човешката проверка е задължителна: всяко изменение влиза в data/
 * само след сверка на дата, НС, указ и текст на параграфите.
 */
import { readJsonArrayStream } from "./json-io.mjs";

const DV_HOME = "https://dv.parliament.bg/";
const JSON_MODE = process.argv.includes("--json");

/** Нормализира "бр. N/дата|година" до "година,брой" за сверка с индекса. */
function issueKey(s) {
  let m = s.match(/^(\d{1,3})\/(\d\d)\.(\d\d)\.(20\d\d)$/);
  if (m) return `${m[4]},${m[1]}`;
  m = s.match(/^(\d{1,3})\/(20\d\d)$/);
  if (m) return `${m[2]},${m[1]}`;
  return null;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "zad-zakona-check/0.1 (civic-project)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  if (!JSON_MODE) console.log("=== Зад Закона — седмична проверка на ДВ ===\n");

  // 1. Последни броеве от началната страница на ДВ
  let homeIssues = [];
  try {
    const html = await fetchText(DV_HOME);
    const issues = new Set();
    const re = /бр\.\s*(\d{1,3})\s*(?:\/|от\s*дата\s*[\d.]+\s*г?.*?)?\s*(?:\/\s*)?(20\d\d)/g;
    let m;
    // по-надеждно: търсим idMat връзки + „брой: N, от дата“
    const re2 = /брой:\s*(\d{1,3}),\s*от\s*дата\s*([\d.]+)/g;
    while ((m = re2.exec(html)) !== null) issues.add(`${m[1]}/${m[2]}`);
    if (issues.size === 0) {
      while ((m = re.exec(html)) !== null) issues.add(`${m[1]}/${m[2]}`);
    }
    homeIssues = [...issues];
    if (!JSON_MODE) {
      console.log(
        issues.size > 0
          ? `Намерени броеве на началната страница:\n  ${homeIssues.slice(0, 15).join(", ")}`
          : "Не са разпознати броеве — отвори https://dv.parliament.bg/ ръчно."
      );
    }
  } catch (e) {
    if (JSON_MODE) {
      console.log(JSON.stringify({ error: `DV home: ${e.message}` }));
      return;
    }
    console.log(`⚠ Не можах да изтегля ${DV_HOME}: ${e.message}`);
    console.log("  Провери ръчно: https://dv.parliament.bg/ → 'Търсене' → 'Народно събрание'.");
  }

  // 2. Какво имаме в data/
  const { readFileSync } = await import("node:fs");
  const laws = JSON.parse(readFileSync("data/laws.json", "utf8"));
  const amendments = JSON.parse(readFileSync("data/amendments.json", "utf8"));
  const byId = Object.fromEntries(amendments.map((a) => [a.id, a]));
  // Индексът се чете стриймнато — трябват ни само агрегати, не целият масив.
  const idxIssues = new Set();
  let indexMaxId = 0;
  let indexSize = 0;
  let needDvMatTotal = 0;
  const needDvMatSample = [];
  for await (const x of readJsonArrayStream("data/acts-index.json")) {
    indexSize++;
    if (x.id > indexMaxId) indexMaxId = x.id;
    if (x.dv_iss && x.dv_year) idxIssues.add(`${x.dv_year},${x.dv_iss}`);
    if (x.dv_iss && !x.dv_mat) {
      needDvMatTotal++;
      if (needDvMatSample.length < 50) needDvMatSample.push(x.id);
    }
  }
  const missingIssues = homeIssues.map(issueKey).filter((k) => k && !idxIssues.has(k));

  if (JSON_MODE) {
    const lawRows = laws.map((law) => {
      const last = byId[law.amendments[0]];
      return {
        name: law.name,
        lastDv: last?.dv ?? null,
        verified: law.amendments.filter((id) => byId[id]?.verified).length,
        total: law.amendments.length,
      };
    });
    console.log(
      JSON.stringify(
        {
          dvHome: homeIssues,
          missingIssues,
          indexMaxId,
          indexSize,
          actsNeedingDvMat: { total: needDvMatTotal, sampleIds: needDvMatSample },
          laws: lawRows,
        },
        null,
        2
      )
    );
    return;
  }
  console.log("\nПокритие в data/ (последно изменение):");
  for (const law of laws) {
    const last = byId[law.amendments[0]];
    const v = law.amendments.filter((id) => byId[id]?.verified).length;
    console.log(
      `  - ${law.name}: ${last ? `${last.dv} (${last.dateAdopted})` : "няма"} · ✓ ${v}/${law.amendments.length}`
    );
  }
  if (missingIssues.length > 0) {
    console.log(`\nНови броеве извън индекса: ${missingIssues.join(" ")}`);
    console.log(`  → node scripts/resolve-dv-mat.mjs --only ${missingIssues.join(" ")}`);
  }
  if (needDvMatTotal > 0) {
    console.log(`Актове с ДВ без dv_mat: ${needDvMatTotal} (напр. ${needDvMatSample.slice(0, 5).join(", ")})`);
  }

  console.log(`
Чеклист за човек (15–30 мин/седмица):
  1. Отвори https://dv.parliament.bg/ → виж новите броеве от последната проверка.
  2. За всеки закон „за изменение…“: отвори текста, запиши ДВ брой, дата,
     НС, указ, президент и параграфите (§) — дословни цитати за before/after.
  3. В parliament.bg → Законопроекти намери сигнатурата и мотивите;
     в Стенограми — поименното гласуване.
  4. Добави обект в data/amendments.json (verified: true, sources.dv, votesVerified)
     и id-то в data/laws.json. Напиши „с прости думи“ за всяка промяна.
  5. npm run build && git push → сайтът се обновява автоматично.
`);
}

main().catch((e) => {
  console.error("Грешка:", e.message);
  process.exit(1);
});
