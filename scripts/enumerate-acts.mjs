/**
 * Изброяване на ВСИЧКИ актове 2021–2026 от API-то на parliament.bg.
 *
 * Употреба:
 *   node scripts/enumerate-acts.mjs            # подновява откъдето е спряло
 *   node scripts/enumerate-acts.mjs --from 163300 --to 168000
 *
 * Как работи: обхожда ID-та на /api/v1/act/{id} (свежо, учтиво: ~1 req/0.8s,
 * един поток, retry с backoff). Записва data/acts-index.json, който може да се
 * подновява многократно — скриптът прескача вече свалени ID-та.
 *
 * Приет закон = има L_Act_dv_iss (брой на ДВ). ВНИМАНИЕ: L_Act_dv_ID е ID на
 * БРОЯ в ДВ, не на материала! Истинският idMat за showMaterialDV.jsp се
 * разрешава отделно: scripts/resolve-dv-mat.mjs (търсене по брой+година в ДВ
 * + мачване по заглавие) → поле dv_mat в acts-index.json.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const API = "https://www.parliament.bg/api/v1/act";
const OUT = "data/acts-index.json";
const UA = "zad-zakona-enumerate/0.1 (civic-project, 1 req/sec)";
const DELAY = 800;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : def;
};
const FROM = opt("--from", 163300);
const TO = opt("--to", 168500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAct(id, tries = 0) {
  try {
    const res = await fetch(`${API}/${id}`, { headers: { "User-Agent": UA } });
    if (res.status === 429 || res.status >= 500) {
      if (tries >= 4) throw new Error(`HTTP ${res.status}`);
      await sleep(5000 * (tries + 1));
      return fetchAct(id, tries + 1);
    }
    if (!res.ok) return null;
    const d = await res.json();
    return d && d.L_Act_id ? d : null;
  } catch (e) {
    if (tries >= 4) {
      console.error(`  ! id ${id}: ${e.message}`);
      return undefined; // не маркирай като свалено — опит пак следващия път
    }
    await sleep(5000 * (tries + 1));
    return fetchAct(id, tries + 1);
  }
}

function slim(d) {
  return {
    id: d.L_Act_id,
    type: d.L_Act_T_id,
    title: d.L_ActL_title || null,
    final: d.L_ActL_final || null,
    date: (d.L_Act_date || "").slice(0, 10) || null,
    sign: d.L_Act_sign || null,
    dv_iss: d.L_Act_dv_iss || null,
    dv_year: d.L_Act_dv_year || null,
    dv_idmat: d.L_Act_dv_ID || null,
  };
}

async function main() {
  let index = [];
  if (existsSync(OUT)) index = JSON.parse(readFileSync(OUT, "utf8"));
  const byId = new Map(index.map((x) => [x.id, x]));
  console.log(`Старт: ${FROM}→${TO}, вече свалени: ${byId.size}`);

  let done = 0;
  for (let id = FROM; id <= TO; id++) {
    if (byId.has(id)) continue;
    const d = await fetchAct(id);
    if (d === undefined) {
      await sleep(DELAY);
      continue; // грешка — пропускаме засега
    }
    if (d) {
      const s = slim(d);
      byId.set(id, s);
      if (s.dv_iss) {
        console.log(`  [${id}] ЗАКОН ${s.dv_iss}/${s.dv_year} ${(s.final || s.title || "").slice(0, 70)}`);
      }
    }
    done++;
    if (done % 100 === 0) {
      writeFileSync(OUT, JSON.stringify([...byId.values()].sort((a, b) => a.id - b.id), null, 1));
      const l = [...byId.values()].filter((x) => x.dv_iss).length;
      console.log(`… ${id} (закони с ДВ досега: ${l})`);
    }
    await sleep(DELAY);
  }
  const all = [...byId.values()].sort((a, b) => a.id - b.id);
  writeFileSync(OUT, JSON.stringify(all, null, 1));
  const withDv = all.filter((x) => x.dv_iss);
  console.log(`\nГотово: ${all.length} документа, от тях ${withDv.length} приети акта с ДВ.`);
  const yrs = {};
  for (const x of withDv) yrs[x.dv_year] = (yrs[x.dv_year] || 0) + 1;
  console.log("По години на ДВ:", JSON.stringify(yrs));
}

main();
