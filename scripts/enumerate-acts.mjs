/**
 * Изброяване на ВСИЧКИ актове 2021–2026 от API-то на parliament.bg.
 *
 * Употреба:
 *   node scripts/enumerate-acts.mjs
 *     (седмична проверка: auto-extend от max ID до 300 поредни липси)
 *   node scripts/enumerate-acts.mjs --refresh-missing [--window 1500]
 *     (препроверка на индексирани БЕЗ ДВ от последните N ID-та —
 *      хваща retrofill: L_Act_dv_iss, попълнен СЛЕД индексирането)
 *   node scripts/enumerate-acts.mjs --from 163300 --to 168000 [--jobs 10]
 *   node scripts/enumerate-acts.mjs --only 167518,167535,167549
 *
 * Как работи: обхожда ID-та на /api/v1/act/{id} (свежо, учтиво: ~1 req/0.8s
 * на worker, retry с backoff). Записва data/acts-index.json, който може да се
 * подновява многократно — скриптът прескача вече свалени ID-та.
 * Пребутването (slim) ПАЗИ обогатяванията (dv_mat и др.) на записа.
 *
 * Приет закон = има L_Act_dv_iss (брой на ДВ). ВНИМАНИЕ: L_Act_dv_ID е ID на
 * БРОЯ в ДВ, не на материала! Истинският idMat за showMaterialDV.jsp се
 * разрешава отделно: scripts/resolve-dv-mat.mjs (търсене по брой+година в ДВ
 * + мачване по заглавие) → поле dv_mat в acts-index.json.
 */
import { existsSync } from "node:fs";
import os from "node:os";
import { readJsonArrayStream, writeJsonArrayFile, serialSaver, argVal } from "./json-io.mjs";

const API = "https://www.parliament.bg/api/v1/act";
const OUT = "data/acts-index.json";
const UA = "zad-zakona-enumerate/0.1 (civic-project, 1 req/sec)";
const DELAY = 800;
// Най-дългата наблюдавана дупка от липсващи ID-та е 214 поредни (10.2026);
// спираме auto-extend чак след 300, за да не пропуснем актове.
const MISS_LIMIT = 300;
const AUTO_CAP = 3000; // параноя: най-много толкова ID-та напред при auto
const ERR_LIMIT = 15; // последователни мрежови грешки → спирам (паднал API)

const args = process.argv.slice(2);
const FROM = Math.max(1, Number(argVal(args, "--from", "163300")) || 163300);
const TO_RAW = argVal(args, "--to", null);
const TO = TO_RAW === null ? null : Number(TO_RAW); // null = auto-extend
const JOBS = Math.max(1, Number(argVal(args, "--jobs", String(os.cpus().length))) || os.cpus().length);
const ONLY_RAW = argVal(args, "--only", null);
const ONLY = ONLY_RAW === null ? null : ONLY_RAW.split(",").map(Number).filter(Boolean);
const REFRESH = args.includes("--refresh-missing");
const WINDOW = Math.max(100, Number(argVal(args, "--window", "1500")) || 1500);

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
  const byId = new Map();
  if (existsSync(OUT)) {
    for await (const x of readJsonArrayStream(OUT)) byId.set(x.id, x);
  }
  const maxKnown = byId.size ? Math.max(...byId.keys()) : FROM - 1;
  // Пребутването пази обогатяванията (dv_mat и др.) — голият slim ги триеше.
  const keep = (id, s) => byId.set(id, { ...byId.get(id), ...s });
  const note = (s) => {
    if (s.dv_iss) console.log(`  [${s.id}] ЗАКОН ${s.dv_iss}/${s.dv_year} ${(s.final || s.title || "").slice(0, 70)}`);
  };
  const save = serialSaver(() =>
    writeJsonArrayFile(OUT, [...byId.values()].sort((a, b) => a.id - b.id), 1)
  );
  const summary = () => {
    const all = [...byId.values()].sort((a, b) => a.id - b.id);
    const withDv = all.filter((x) => x.dv_iss);
    console.log(`\nГотово: ${all.length} документа, от тях ${withDv.length} приети акта с ДВ.`);
    const yrs = {};
    for (const x of withDv) yrs[x.dv_year] = (yrs[x.dv_year] || 0) + 1;
    console.log("По години на ДВ:", JSON.stringify(yrs));
  };

  // 1) --refresh-missing: препроверка на индексирани БЕЗ ДВ (retrofill прозорец)
  if (REFRESH) {
    const cut = maxKnown - WINDOW;
    const queue = [...byId.values()]
      .filter((x) => !x.dv_iss && x.id >= cut)
      .map((x) => x.id)
      .sort((a, b) => a - b);
    console.log(`Refresh-missing: ${queue.length} без ДВ (id >= ${cut}), workers: ${JOBS}`);
    let qi = 0;
    let rdone = 0;
    async function rworker() {
      for (;;) {
        const i = qi++;
        if (i >= queue.length) return;
        const id = queue[i];
        const d = await fetchAct(id);
        if (d === undefined) {
          await sleep(DELAY);
          continue;
        }
        if (d) {
          const s = { ...slim(d), id };
          const before = byId.get(id)?.dv_iss;
          keep(id, s);
          if (s.dv_iss && !before) console.log(`  [+] ${id} получи ДВ ${s.dv_iss}/${s.dv_year}`);
        }
        if (++rdone % 50 === 0) {
          await save();
          console.log(`… ${rdone}/${queue.length}`);
        }
        await sleep(DELAY);
      }
    }
    await Promise.all(Array.from({ length: Math.min(JOBS, Math.max(1, queue.length)) }, rworker));
    await save();
    summary();
    return;
  }

  // 2) --only: конкретни ID-та (същият keep, без clobber)
  const ids = ONLY ?? null;
  if (ids) {
    console.log(`Only: ${ids.length} ID-та, workers: ${JOBS}`);
    let done = 0;
    async function oworker() {
      for (;;) {
        const id = ids.shift();
        if (id === undefined) return;
        const d = await fetchAct(id);
        if (d === undefined) {
          await sleep(DELAY);
          continue;
        }
        if (d) {
          const s = { ...slim(d), id };
          keep(id, s);
          note(s);
        }
        if (++done % 50 === 0) await save();
        await sleep(DELAY);
      }
    }
    await Promise.all(Array.from({ length: Math.min(JOBS, Math.max(1, ids.length)) }, oworker));
    await save();
    summary();
    return;
  }

  // 3) Range scan: изричен --to или auto-extend от maxKnown+1
  const auto = !Number.isFinite(TO);
  let next = auto ? Math.max(FROM, maxKnown + 1) : FROM;
  const stopAt = auto ? next + AUTO_CAP : TO;
  console.log(
    auto
      ? `Старт: auto от ${next} (max известен ${maxKnown}), стоп след ${MISS_LIMIT} поредни липси, workers: ${JOBS}`
      : `Старт: ${FROM}→${TO}, вече свалени: ${byId.size}, workers: ${JOBS}`
  );
  let done = 0;
  let consecMiss = 0;
  let consecErr = 0;
  let autoStop = false;
  async function worker() {
    for (;;) {
      if (autoStop) return;
      const id = next++;
      if (id > stopAt) {
        autoStop = true;
        return;
      }
      if (byId.has(id)) continue; // без заявка и без пауза
      const d = await fetchAct(id);
      if (d === undefined) {
        if (++consecErr >= ERR_LIMIT) {
          autoStop = true;
          console.log("  ! твърде много мрежови грешки — спирам, пробвай пак по-късно");
          return;
        }
        await sleep(DELAY); // грешка — пропускаме засега
        continue;
      }
      consecErr = 0;
      if (d) {
        consecMiss = 0;
        const s = { ...slim(d), id };
        keep(id, s);
        note(s);
      } else if (auto && ++consecMiss >= MISS_LIMIT) {
        autoStop = true;
        return;
      }
      done++;
      if (done % 200 === 0) {
        await save();
        const l = [...byId.values()].filter((x) => x.dv_iss).length;
        console.log(`… ${done} (закони с ДВ досега: ${l})`);
      }
      await sleep(DELAY);
    }
  }
  await Promise.all(Array.from({ length: JOBS }, worker));
  await save();
  summary();
}

main();
