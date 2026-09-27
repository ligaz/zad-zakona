/**
 * Сваля bill-данни за всички basic изменения: вносители, сигнатура, дати, мотиви, вето.
 * Употреба: node scripts/fetch-basics-bills.mjs  (пише /tmp/bills-basics.json)
 */
import { writeFileSync } from "node:fs";

const API = "https://www.parliament.bg/api/v1/bill";
const UA = "zad-zakona-votes/0.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jget(url, tries = 0) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    if (tries >= 3) throw e;
    await sleep(3000 * (tries + 1));
    return jget(url, tries + 1);
  }
}

// id в amendments.json -> bill ID в parliament.bg
const PLAN = [
  ["ik-23-2026", 166803], ["zdvp-18-2021", 163516], ["zdvp-64-2025", 166333],
  ["zdvp-16-2026", 166783], ["nk-53-2022", 164080], ["nk-39-2024", 165296],
  ["nk-61-2025", 166498], ["nk-65-2025", 166522], ["nk-115-2025", 166578],
  ["nk-27-2026", 166636], ["nk-32-2026", 166886], ["zchr-21-2021", 163303],
  ["zchr-67-2023", 164822], ["zchr-39-2024", 165516], ["zzo-21-2021", 163508],
  ["zzo-32-2022", 164085], ["zzo-13-2023", 164587], ["zzo-64-2023", 164952],
  ["zzo-82-2023", 165012], ["zzo-13-2024", 165328], ["zzo-64-2025", 166151],
  ["zzo-97-2025", 166619],
];

const cap = (s) =>
  (s || "").toLowerCase().replace(/(^|\s|-)(\S)/g, (_, a, b) => a + b.toUpperCase());

const out = [];
for (const [id, billId] of PLAN) {
  const j = await jget(`${API}/${billId}`);
  await sleep(500);
  const mps = (j.imp_list || []).map((m) =>
    cap(`${m.A_ns_MPL_Name1} ${m.A_ns_MPL_Name2} ${m.A_ns_MPL_Name3}`.trim())
  );
  out.push({
    id, billId,
    title: j.L_ActL_title,
    sign: j.L_Act_sign,
    date: (j.L_Act_date || "").slice(0, 10),
    proposalDate: (j.L_act_proposal_date || "").slice(0, 10),
    vnositeli: mps,
    unionLabel: j.union_label || "",
    veto: j.L_Act_veto || "",
    vetoDate: (j.L_Act_veto_date || "").slice(0, 10),
    dvIss: j.L_Act_dv_iss, dvYear: j.L_Act_dv_year,
    dvId: j.L_Act_dv_ID,
    files: (j.file_list || []).map((f) => f.FILENAME),
  });
  console.error(`ok ${id} (${billId}): ${mps.length} вносители`);
}
writeFileSync("/tmp/bills-basics.json", JSON.stringify(out, null, 2));
console.log("saved", out.length);
