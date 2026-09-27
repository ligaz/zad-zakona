/**
 * Гласувания за basic измененията през ТОЧНИТЕ стенограми (steno_hall от bill API).
 * Употреба: node scripts/fetch-basics-votes.mjs  (пише /tmp/votes-basics.json)
 */
import { writeFileSync } from "node:fs";

const API = "https://www.parliament.bg/api/v1";
const UA = "zad-zakona-votes/0.1";
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

// id, billId, nsNum, ключови думи в темата на гласуването
const PLAN = [
  ["ik-23-2026", 166803, 51, ["изборния кодекс"]],
  ["zdvp-18-2021", 163516, 44, ["движението по пътищата"]],
  ["zdvp-64-2025", 166333, 51, ["движението по пътищата"]],
  ["zdvp-16-2026", 166783, 51, ["движението по пътищата"]],
  ["nk-53-2022", 164080, 47, ["наказателния кодекс"]],
  ["nk-39-2024", 165296, 49, ["наказателния кодекс"]],
  ["nk-61-2025", 166498, 51, ["наказателния кодекс"]],
  ["nk-65-2025", 166522, 51, ["наказателния кодекс"]],
  ["nk-115-2025", 166578, 51, ["наказателния кодекс"]],
  ["nk-27-2026", 166636, 51, ["наказателния кодекс"]],
  ["nk-32-2026", 166886, 51, ["наказателния кодекс"]],
  ["zchr-21-2021", 163303, 44, ["чужденците"]],
  ["zchr-67-2023", 164822, 49, ["чужденците"]],
  ["zchr-39-2024", 165516, 49, ["чужденците"]],
  ["zzo-21-2021", 163508, 44, ["здравното осигуряване"]],
  ["zzo-32-2022", 164085, 47, ["здравното осигуряване"]],
  ["zzo-13-2023", 164587, 48, ["здравното осигуряване"]],
  ["zzo-64-2023", 164952, 49, ["здравното осигуряване"]],
  ["zzo-82-2023", 165012, 49, ["здравното осигуряване"]],
  ["zzo-13-2024", 165328, 49, ["здравното осигуряване"]],
  ["zzo-64-2025", 166151, 51, ["здравното осигуряване"]],
  ["zzo-97-2025", 166619, 51, ["здравното осигуряване"]],
];

const parseRow = (r) => {
  const nums = r.slice(10).filter((x) => /^\d+$/.test(x)).map(Number);
  if (nums.length >= 5) return { party: r[9], za: nums[1], protiv: nums[2], vazdrzhal: nums[3] };
  return { party: r[9], za: nums[0] || 0, protiv: nums[1] || 0, vazdrzhal: nums[2] || 0 };
};

const out = [];
for (const [id, billId, nsNum, kws] of PLAN) {
  const entry = { id, billId, kws };
  try {
    const bill = await (await jget(`${API}/bill/${billId}`)).json();
    await sleep(400);
    const hall = bill.steno_hall || [];
    const second = [...new Set(hall.filter((h) => (h.L_Act_St2_name || "").includes("второ")).map((h) => h.Pl_Sten_id))];
    const first = [...new Set(hall.filter((h) => (h.L_Act_St2_name || "").includes("първо")).map((h) => h.Pl_Sten_id))];
    entry.stenIds = { second, first };
    const ordered = [...second, ...first].slice(0, 2);
    let found = null;
    for (const sid of ordered) {
      const sten = await (await jget(`${API}/pl-sten/${sid}`)).json();
      await sleep(400);
      const csvs = (sten.files || []).filter((f) => f.Pl_StenDfile && f.Pl_StenDfile.endsWith(".csv"));
      const mine = [];
      const seen = new Set();
      for (const csv of csvs) {
        const text = await (await jget("https://www.parliament.bg" + csv.Pl_StenDfile)).text();
        await sleep(400);
        const rows = text.split(/\r?\n/).slice(1).map((l) =>
          l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, ""))
        );
        for (const r of rows) {
          if (!r[0] || !kws.every((k) => r[0].toLowerCase().includes(k))) continue;
          const key = r[0] + "||" + r[9];
          if (seen.has(key)) continue;
          seen.add(key);
          mine.push(r);
        }
      }
      const topics = [...new Set(mine.map((r) => r[0]))];
      const cands = [];
      let pick = null;
      for (const t of topics) {
        const vp = mine.filter((r) => r[0] === t).map(parseRow);
        const za = vp.reduce((s, p) => s + p.za, 0);
        const no = vp.reduce((s, p) => s + p.protiv + p.vazdrzhal, 0);
        cands.push({ t: t.slice(0, 120), za, no, parties: vp.length });
        if (za > no) pick = { topic: t, votes: vp };
      }
      entry["sten" + sid] = { date: sten.Pl_Sten_date, csvs: csvs.length, cands };
      if (pick) {
        found = {
          stenId: sid, stenDate: sten.Pl_Sten_date,
          stenUrl: `https://www.parliament.bg/bg/plenaryst/ns/${NS_API[nsNum]}/ID/${sid}`,
          topic: pick.topic.slice(0, 200),
          votes: {
            za: pick.votes.reduce((s, p) => s + p.za, 0),
            protiv: pick.votes.reduce((s, p) => s + p.protiv, 0),
            vazdrzhal: pick.votes.reduce((s, p) => s + p.vazdrzhal, 0),
          },
          votesByParty: pick.votes,
        };
        break;
      }
    }
    entry.pick = found;
    out.push(entry);
    console.error(`${found ? "VOTE " : "MISS "}${id}: ${found ? JSON.stringify(found.votes) + " " + found.topic.slice(0, 80) : ""}`);
  } catch (e) {
    entry.error = e.message;
    console.error(`ERR ${id}: ${e.message}`);
  }
  await sleep(300);
}
writeFileSync("/tmp/votes-basics.json", JSON.stringify(out, null, 2));
console.log("saved", out.length);
