/**
 * Пълен pipeline за актове: bill → стенограма (2-ро гласуване) → вот (CSV/XLSX)
 * → сверка с обявлението в стенограмата → детайли (членове, указ, вносител).
 * Употреба: node scripts/fetch-act-details.mjs --out FILE --only ID [ID...] --jobs 3
 *   (без --only: всички с ДВ от 2021+, прескача готовите в OUT)
 *   --jobs N: паралелни worker-а (default 3; учтиво към parliament.bg: 900ms между
 *   актовете + 400ms между заявките на worker, retry с backoff при 429/5xx).
 */
import { readFileSync, existsSync } from "node:fs";
import { readJsonArrayStream, writeJsonDictFile, serialSaver } from "./json-io.mjs";
import { inflateRawSync } from "node:zlib";

const UA = "zad-zakona-details/0.1";
const API = "https://www.parliament.bg/api/v1";
const NS_API = { 44: 52, 45: 55, 46: 56, 47: 57, 48: 58, 49: 59, 50: 60, 51: 61, 52: 62 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jget(url, tries = 0) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } catch (e) {
    if (tries >= 3) throw e;
    await sleep(3000 * (tries + 1));
    return jget(url, tries + 1);
  }
}

const STOP = new Set(["закон", "за", "закона", "законът", "изменение", "изменения", "изменението", "допълнение", "допълнението", "на", "в", "във", "и", "по", "от", "с", "със", "за", "република", "българия", "българската", "българските", "българията", "н", "р", "относно", "кодекс", "кодекса", "решение", "решения", "приемане", "доклад", "доклада", "народното", "събрание", "народно", "нов", "нова", "ново", "както", "държавен", "вестник", "изменение", "допълнение"]);

// ключови думи: отличителната именна фраза (без "закон за изменение на ...")
function keywords(title) {
  let t = (title || "").toLowerCase();
  // махни преамбюла до същинското име на акта
  t = t.replace(/^закон за (изменение и допълнение|изменение|допълнение) на (закона за |кодекса |кодекс )?/, "")
    .replace(/^закон за /, "")
    .replace(/^решение за /, "")
    .replace(/^решение по /, "");
  const words = t.split(/\s+/).filter((w) => w.length > 4 && !STOP.has(w));
  return words.slice(0, 5);
}

const parseRow = (r) => {
  const nums = r.slice(10).filter((x) => /^\d+$/.test(x)).map(Number);
  if (nums.length >= 5) return { party: r[9], za: nums[1], protiv: nums[2], vazdrzhal: nums[3] };
  return { party: r[9], za: nums[0] || 0, protiv: nums[1] || 0, vazdrzhal: nums[2] || 0 };
};

function unzip(buf, name) {
  let off = 0;
  while (off < buf.length - 30) {
    if (buf.readUInt32LE(off) !== 0x04034b50) { off++; continue; }
    const method = buf.readUInt16LE(off + 8);
    const csize = buf.readUInt32LE(off + 18);
    const nlen = buf.readUInt16LE(off + 26);
    const elen = buf.readUInt16LE(off + 28);
    const nm = buf.toString("utf8", off + 30, off + 30 + nlen);
    const data = buf.subarray(off + 30 + nlen + elen, off + 30 + nlen + elen + csize);
    if (nm === name) {
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error("zipm " + method);
    }
    off += 30 + nlen + elen + csize;
  }
  throw new Error("nf " + name);
}

function sheetRows(xml) {
  const rows = [];
  for (const m of xml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const cells = {};
    for (const c of m[1].matchAll(/<c[^>]*r="([A-Z]+)\d+"[^>]*>(.*?)<\/c>/gs)) {
      const t = [...c[2].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join("");
      const v = c[2].match(/<v>(.*?)<\/v>/);
      cells[c[1]] = t || (v ? v[1] : "");
    }
    rows.push(cells);
  }
  return rows;
}

const bodyCache = new Map();
async function stenJson(sid) {
  if (!bodyCache.has(sid)) {
    bodyCache.set(sid, (await (await jget(`${API}/pl-sten/${sid}`)).json()));
    await sleep(400);
  }
  return bodyCache.get(sid);
}

async function votesFromSten(sid, kws) {
  const sten = await stenJson(sid);
  const files = sten.files || [];
  const mine = [];
  const seen = new Set();
  const pushRows = (topic, party, za, pr, vz) => {
    const key = topic + "||" + party;
    if (seen.has(key)) return;
    seen.add(key);
    mine.push({ topic, party, za, pr, vz });
  };
  for (const f of files.filter((x) => x.Pl_StenDfile?.endsWith(".csv"))) {
    const text = await (await jget("https://www.parliament.bg" + f.Pl_StenDfile)).text();
    await sleep(400);
    for (const line of text.split(/\r?\n/).slice(1)) {
      const r = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, ""));
      if (!r[0] || !kws.every((k) => r[0].toLowerCase().includes(k))) continue;
      const p = parseRow(r);
      pushRows(r[0], p.party, p.za, p.protiv, p.vazdrzhal);
    }
  }
  for (const f of files.filter((x) => x.Pl_StenDfile?.endsWith(".xlsx"))) {
    const buf = Buffer.from(await (await jget("https://www.parliament.bg" + f.Pl_StenDfile)).arrayBuffer());
    await sleep(400);
    let rows;
    try {
      rows = sheetRows(unzip(buf, "xl/worksheets/sheet1.xml").toString("utf-8"));
    } catch { continue; }
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i].A || "";
      if (!a.includes("ГЛАСУВАНЕ") || !kws.every((k) => a.toLowerCase().includes(k))) continue;
      for (let j = i + 1; j < Math.min(i + 16, rows.length); j++) {
        const r = rows[j];
        if ((r.A || "").includes("ГЛАСУВАНЕ") || (r.A || "").includes("РЕГИСТРАЦИЯ")) break;
        if (!r.A || r.A === "ПГ" || r.A === "Общо:") continue;
        if (/^\d+$/.test(r.C || "") || /^\d+$/.test(r.D || "")) {
          pushRows(a, r.A, Number(r.C) || 0, Number(r.D) || 0, Number(r.E) || 0);
        }
      }
    }
  }
  const topics = [...new Set(mine.map((r) => r.topic))];
  const out = [];
  for (const t of topics) {
    const vp = mine.filter((r) => r.topic === t);
    out.push({
      topic: t,
      za: vp.reduce((s, p) => s + p.za, 0),
      no: vp.reduce((s, p) => s + p.pr + p.vz, 0),
      parties: vp.map((p) => ({ party: p.party, za: p.za, protiv: p.pr, vazdrzhal: p.vz })),
    });
  }
  return { sten, cands: out };
}

// граници на точки от дневния ред → сегменти
const BOUND = /[Пп]реминаваме към|следваща точка|следващата точка|точка \d+[^.]{0,80}дневен ред|Закривам заседанието|прекъсвам заседанието|обявявам почивка|след почивката/ig;

function segments(t) {
  const bounds = [0, ...[...t.matchAll(BOUND)].map((m) => m.index), t.length];
  const segs = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    segs.push({ start: bounds[i], end: bounds[i + 1], text: t.slice(bounds[i], bounds[i + 1]) });
  }
  return segs;
}

// нашите сегменти: ≥2 ключови думи (+ доклад/вносител/точка/гласуване в началото)
function ourSegments(t, kws) {
  const segs = segments(t);
  const kk = kws.filter((k) => k.length > 4);
  return segs.filter((s) => {
    const low = s.text.toLowerCase();
    return kk.filter((k) => low.includes(k)).length >= 2
      && /доклад|вносител|точка|проект за решение|законопроект|преминаваме към гласуване|режим на гласуване|подлагам на гласуване/i.test(s.text.slice(0, 1500));
  });
}

// финална декларация: приемане + край на точката
const FINAL_RE = /завършваме|закривам|прекъсвам|следващ[а-я]* точк|преминаваме|изчерпахме|приет[ао]? на второ (гласуване|четене)|(законопроектът|законът|решението|стратегията)[^.]{0,60}приет/i;

function parseAnn(s) {
  const zaM = s.match(/за (\d+)/);
  if (!zaM) return null;
  const prM = s.match(/против (?:няма|(\d+))/);
  const vzM = s.match(/въздържали се (?:няма|(\d+))/) || s.match(/въздържал се (\d+)/);
  return { za: Number(zaM[1]), pr: prM?.[1] ? Number(prM[1]) : 0, vz: vzM?.[1] ? Number(vzM[1]) : 0 };
}

// строга сверка: обявление с точните числа + "приет" до 500 знака + ключова дума наблизо
function verify(body, votes, kws) {
  const t = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const { za, protiv, vazdrzhal } = votes;
  for (const m of t.matchAll(/Гласували[^.]{0,220}/g)) {
    const s = m[0];
    const okZa = s.includes(`за ${za}`);
    const okPr = protiv === 0 ? /против (няма|0)/.test(s) : s.includes(`против ${protiv}`);
    const okVz = vazdrzhal === 0 ? /въздържали се няма/.test(s)
      : vazdrzhal === 1 ? /въздържал се 1/.test(s) : s.includes(`въздържали се ${vazdrzhal}`);
    if (!(okZa && okPr && okVz)) continue;
    const after = t.slice(m.index, m.index + 600);
    const before = t.slice(Math.max(0, m.index - 400), m.index);
    if (/приет|прието|прие[хт]/i.test(after) && kws.some((k) => k.length > 4 && (after.toLowerCase().includes(k) || before.toLowerCase().includes(k)))) {
      return { ok: true, ctx: after.slice(0, 200) };
    }
  }
  return { ok: false };
}

// вот на приемане: последният приет вот в ПОСЛЕДНИЯ наш сегмент + финален маркер
function adoptionInSegment(t, kws) {
  const segs = ourSegments(t, kws);
  for (let si = segs.length - 1; si >= 0; si--) {
    const seg = segs[si];
    const votes = [...seg.text.matchAll(/Гласували[^.]{0,220}/g)];
    for (let vi = votes.length - 1; vi >= 0; vi--) {
      const mm = votes[vi];
      const p = parseAnn(mm[0]);
      if (!p) continue;
      const after = seg.text.slice(mm.index, mm.index + 700);
      if (!/приет|прието|прие[хт]/i.test(after)) continue;
      if (p.za <= p.pr + p.vz) continue; // приет
      if (!FINAL_RE.test(after)) continue; // процедурно, не финал
      return { za: p.za, protiv: p.pr, vazdrzhal: p.vz, ctx: after.slice(0, 200) };
    }
  }
  return null;
}

function strip(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function processAct(x) {
  const id = x.id;
  const rec = { actId: id };
  const kws = keywords(x.final || x.title);
  rec.kws = kws;
  // 1) bill: стенограми + вносител
  let bill = null;
  try {
    bill = await (await jget(`${API}/bill/${id}`)).json();
    await sleep(400);
  } catch (e) {
    rec.error = "bill:" + e.message;
    return rec;
  }
  const hall = bill.steno_hall || [];
  const second = [...new Set(hall.filter((h) => (h.L_Act_St2_name || "").includes("второ")).map((h) => h.Pl_Sten_id))];
  const first = [...new Set(hall.filter((h) => (h.L_Act_St2_name || "").includes("първо")).map((h) => h.Pl_Sten_id))];
  rec.stenIds = { second, first };
  const mps = (bill.imp_list || []).map((m) =>
    `${m.A_ns_MPL_Name1} ${m.A_ns_MPL_Name2} ${m.A_ns_MPL_Name3}`.toLowerCase().replace(/(^|\s|-)(\S)/g, (_, a, b) => a + b.toUpperCase()).trim()
  );
  if (mps.length) rec.vnositel = mps;
  else if ((bill.union_label || "").includes("бединен")) rec.vnositel = "union";
  else rec.vnositel = "MC";
  if (bill.L_Act_date2) rec.adoptGuess = String(bill.L_Act_date2).slice(0, 10);
  const dateDiff = (d) => {
    if (!rec.adoptGuess || !d) return 999;
    return Math.abs(new Date(d) - new Date(rec.adoptGuess)) / 864e5;
  };
  // 2) вотове от стенограмите (2-ро, после 1-во) — събираме всички, избираме най-близкия до датата на приемане
  let pick = null, stenBody = "", stenDate = "";
  const tried = [];
  const allPicks = [];
  for (const sid of [...second, ...first].slice(0, 2)) {
    if (!sid || sid === 1) continue;
    tried.push(sid);
    const { sten, cands } = await votesFromSten(sid, kws);
    rec["cands" + sid] = cands.map((c) => ({ t: c.topic.slice(0, 100), za: c.za, no: c.no }));
    for (const c of cands) {
      if (c.za > c.no) allPicks.push({ ...c, stenId: sid, stenDate: sten.Pl_Sten_date, body: sten.Pl_Sten_body || "" });
    }
  }
  if (allPicks.length) {
    allPicks.sort((a, b) => dateDiff(a.stenDate) - dateDiff(b.stenDate));
    pick = allPicks[0];
    stenBody = pick.body;
    stenDate = pick.stenDate;
    if (dateDiff(stenDate) > 4) {
      rec.dateWarn = `вотът е от ${stenDate}, приемането ~${rec.adoptGuess}`;
    }
  }
  // fallback 1: няма линкната стенограма → търсене по дата на приемане (L_Act_date2)
  if (!pick && rec.adoptGuess) {
    const ds = rec.adoptGuess;
    const [y, m] = ds.split("-").map(Number);
    try {
      const pers = await (await jget(`${API}/archive-period/bg/Pl_StenV/${y}/${m}/0/0`)).json();
      await sleep(400);
      const near = pers.filter((p) => Math.abs(new Date(p.t_date) - new Date(ds)) / 864e5 <= 5);
      for (const c of near.slice(0, 4)) {
        tried.push(c.t_id);
        const { sten, cands } = await votesFromSten(c.t_id, kws);
        rec["cands" + c.t_id] = cands.map((x) => ({ t: x.topic.slice(0, 100), za: x.za, no: x.no }));
        for (const x of cands) {
          if (x.za > x.no) pick = { ...x, stenId: c.t_id, stenDate: sten.Pl_Sten_date };
        }
        if (pick) {
          stenBody = sten.Pl_Sten_body || "";
          stenDate = sten.Pl_Sten_date || "";
          break;
        }
      }
    } catch (e) {
      rec.fallbackErr = e.message;
    }
  }
  // fallback 2: файлове без разбивка → вот на приемане в НАШАТА точка
  if (!pick && tried.length) {
    for (const sid of tried) {
      try {
        const sten = await stenJson(sid);
        stenBody = sten.Pl_Sten_body || "";
        stenDate = sten.Pl_Sten_date || "";
        if (!stenBody) continue;
        const ad = adoptionInSegment(stenBody, kws);
        if (ad) {
          rec.pick = { topic: `Обявление в стенограма: за ${ad.za}, против ${ad.protiv}, въздържали се ${ad.vazdrzhal}`, votes: { za: ad.za, protiv: ad.protiv, vazdrzhal: ad.vazdrzhal }, totalsOnly: true, stenId: sid, stenDate, parties: [], ctx: ad.ctx };
          rec.verified = "partial";
          return rec;
        }
      } catch { /* noop */ }
    }
  }
  // fallback 0: никаква стенограма → дата на приемане от ДВ материала (имаме dv_mat)
  if (!pick && !tried.length && x.dv_mat) {
    try {
      const r = await fetch(`https://dv.parliament.bg/DVWeb/showMaterialDV.jsp?idMat=${x.dv_mat}`, { headers: { "User-Agent": UA } });
      const html = await r.text();
      await sleep(400);
      const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const dm = t.match(/[Пп]риет[ао]? (?:от .*? )?на (\d{1,2}) ([а-я]+) (\d{4})/) || t.match(/(\d{1,2}) ([а-я]+) (\d{4}) г\./);
      if (dm) {
        const MON = { януари: "01", февруари: "02", март: "03", април: "04", май: "05", юни: "06", юли: "07", август: "08", септември: "09", октомври: "10", ноември: "11", декември: "12" };
        const ds = `${dm[3]}-${MON[dm[2].toLowerCase()] || "01"}-${String(dm[1]).padStart(2, "0")}`;
        rec.adoptGuess = ds + " (DV)";
        const [y, m] = ds.split("-").map(Number);
        const pers = await (await jget(`${API}/archive-period/bg/Pl_StenV/${y}/${m}/0/0`)).json();
        await sleep(400);
        const near = pers.filter((p) => Math.abs(new Date(p.t_date) - new Date(ds)) / 864e5 <= 6);
        for (const c of near.slice(0, 5)) {
          tried.push(c.t_id);
          const { sten, cands } = await votesFromSten(c.t_id, kws);
          rec["cands" + c.t_id] = cands.map((xx) => ({ t: xx.topic.slice(0, 100), za: xx.za, no: xx.no }));
          for (const xx of cands) {
            if (xx.za > xx.no) pick = { ...xx, stenId: c.t_id, stenDate: sten.Pl_Sten_date };
          }
          if (pick) {
            stenBody = sten.Pl_Sten_body || "";
            stenDate = sten.Pl_Sten_date || "";
            tried.push(c.t_id);
            break;
          }
        }
        // transcript totals в нашата точка (във всяка опитана)
        if (!pick) {
          for (const sid of tried) {
            try {
              const sten = await stenJson(sid);
              const ad = adoptionInSegment(sten.Pl_Sten_body || "", kws);
              if (ad) {
                rec.pick = { topic: `Обявление в стенограма: за ${ad.za}, против ${ad.protiv}, въздържали се ${ad.vazdrzhal}`, votes: { za: ad.za, protiv: ad.protiv, vazdrzhal: ad.vazdrzhal }, totalsOnly: true, stenId: sid, stenDate: sten.Pl_Sten_date || "", parties: [], ctx: ad.ctx };
                rec.verified = "partial";
                return rec;
              }
            } catch { /* noop */ }
          }
        }
      } else {
        rec.status = "no-date";
        return rec;
      }
    } catch (e) {
      rec.status = "dv-err:" + e.message;
      return rec;
    }
  }
  if (!pick) {
    rec.status = "no-vote";
    return rec;
  }
  // 3) сверка (+ близост на датата до приемането)
  const v = { za: pick.za, protiv: 0, vazdrzhal: 0 };
  // преизчисли protiv/vazdrzhal от parties
  v.protiv = pick.parties.reduce((s, p) => s + p.protiv, 0);
  v.vazdrzhal = pick.parties.reduce((s, p) => s + p.vazdrzhal, 0);
  const ver = verify(stenBody, v, kws);
  rec.pick = { topic: pick.topic.slice(0, 160), votes: v, stenId: pick.stenId, stenDate: pick.stenDate, parties: pick.parties };
  rec.verified = ver.ok;
  if (!ver.ok) {
    // CSV ≠ обявеното (хибридна ера зала+онлайн): взимаме обявените тотали от нашата точка
    const ad = adoptionInSegment(stenBody, kws);
    if (ad) {
      rec.pick = { topic: `Обявление в стенограма: за ${ad.za}, против ${ad.protiv}, въздържали се ${ad.vazdrzhal}`, votes: { za: ad.za, protiv: ad.protiv, vazdrzhal: ad.vazdrzhal }, totalsOnly: true, stenId: pick.stenId, stenDate: pick.stenDate, parties: [], ctx: ad.ctx, csvMismatch: v };
      rec.verified = "partial";
      delete rec.status;
    } else {
      rec.status = "quarantine";
    }
  }
  else if (dateDiff(pick.stenDate) > 4) {
    rec.verified = false;
    rec.status = "quarantine:date";
  }
  return rec;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Употреба: node scripts/fetch-act-details.mjs [--out FILE] [--only ID...] [--jobs N]");
    console.log("  --only спира до следващия --флаг; --jobs default 3 (учтиво към parliament.bg)");
    return;
  }
  const val = (name, def) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
  };
  const idx = [];
  for await (const x of readJsonArrayStream("data/acts-index.json")) {
    if (x.dv_iss && x.dv_year && x.dv_year >= 2021) idx.push(x);
  }
  const ai = argv.indexOf("--only");
  let only = null;
  if (ai >= 0) {
    only = new Set();
    for (const x of argv.slice(ai + 1)) {
      if (x.startsWith("--")) break;
      const n = Number(x);
      if (Number.isFinite(n)) only.add(n);
    }
  }
  const OUT = val("--out", "/tmp/act-details.json");
  const JOBS = Math.max(1, Number(val("--jobs", "3")) || 3);
  // Dict resume остава буфериран нарочно — dedup `done[id]` иска random-access.
  const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const queue = idx.filter((x) => (only ? only.has(x.id) : !done[x.id]));
  console.log(`Старт: ${queue.length} акта, workers: ${JOBS} (учтиво: 900ms между актовете + 400ms между заявките на worker)`);
  let n = 0;
  let next = 0;
  const save = serialSaver(() => writeJsonDictFile(OUT, done));
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= queue.length) return;
      const x = queue[i];
      try {
        done[x.id] = await processAct(x);
        const p = done[x.id].pick;
        console.log(`${p ? (done[x.id].verified ? "OK  " : "QUAR") : "MISS"} ${x.id} ${p ? JSON.stringify(p.votes) : ""} ${(p?.topic || "").slice(0, 60)}`);
      } catch (e) {
        done[x.id] = { actId: x.id, error: e.message };
        console.log(`ERR ${x.id} ${e.message}`);
      }
      if (++n % 10 === 0) await save();
      await sleep(900);
    }
  }
  await Promise.all(Array.from({ length: Math.min(JOBS, Math.max(1, queue.length)) }, worker));
  await save();
  console.log("saved", Object.keys(done).length);
}
main();
