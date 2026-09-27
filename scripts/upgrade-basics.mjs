/**
 * Обновява 22-те basic изменения с реални данни:
 * гласувания (стенограми, сверени с обявленията), вносители, stenogramLink, billUrl.
 * Употреба: node scripts/upgrade-basics.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const NORM = {
  "ГЕРБ - СДС": "ГЕРБ-СДС", "ПП - ДБ": "ПП-ДБ", "ДПС - НН": "ДПС",
  "БСП - ОЛ": "БСП", "ВЪЗРАЖДАНЕ": "Възраждане", "ВЕЛИЧИЕ": "Величие",
  "НЕЧЛ В ПГ": "независими", "НЕЗ": "независими",
};
const normParty = (p) => NORM[p] ?? p;

function normVotes(list) {
  const m = new Map();
  for (const e of list) {
    const p = normParty((e.party || "").trim());
    if (!p) continue;
    const cur = m.get(p) ?? { party: p, za: 0, protiv: 0, vazdrzhal: 0 };
    cur.za += e.za || 0; cur.protiv += e.protiv || 0; cur.vazdrzhal += e.vazdrzhal || 0;
    m.set(p, cur);
  }
  return [...m.values()];
}

const votesData = Object.fromEntries(
  JSON.parse(readFileSync("/tmp/votes-basics.json", "utf8"))
    .filter((e) => e.pick)
    .map((e) => [e.id, e.pick])
);
votesData["nk-65-2025"] = JSON.parse(readFileSync("/tmp/vote-nk65.json", "utf8"));
votesData["nk-65-2025"].stenUrl = "https://www.parliament.bg/bg/plenaryst/ns/61/ID/11040";

// само общи бройки от обявленията в стенограмите (няма CSV/XLSX разбивка)
const totalsOnly = {
  "zdvp-18-2021": { votes: { za: 119, protiv: 0, vazdrzhal: 2 }, sten: "https://www.parliament.bg/bg/plenaryst/ns/52/ID/10546" },
  "zchr-21-2021": { votes: { za: 70, protiv: 1, vazdrzhal: 3 }, sten: "https://www.parliament.bg/bg/plenaryst/ns/52/ID/10549" },
  "zzo-21-2021": { votes: { za: 71, protiv: 16, vazdrzhal: 2 }, sten: "https://www.parliament.bg/bg/plenaryst/ns/52/ID/10548" },
};

const bills = Object.fromEntries(
  JSON.parse(readFileSync("/tmp/bills-basics.json", "utf8")).map((b) => [b.id, b])
);

// вносители: сверени (imp_list от bill API + обявления „Вносител" в стенограмите)
const VN = {
  "ik-23-2026": ["депутати", "Костадин Костадинов, Петър Петров и Цончо Ганев (Възраждане)"],
  "zdvp-18-2021": ["депутати", "Красимир Ципов и още 7 народни представители"],
  "zdvp-64-2025": [null, "Обединен законопроект"],
  "zdvp-16-2026": ["депутати", "Кирил Добрев и Андрей Рунчев"],
  "nk-53-2022": ["МС", "Министерски съвет (кабинет Петков)"],
  "nk-39-2024": ["МС", "Министерски съвет (кабинет Денков)"],
  "nk-61-2025": [null, "Обединен законопроект"],
  "nk-65-2025": ["МС", "Министерски съвет (кабинет Желязков)"],
  "nk-115-2025": ["МС", "Министерски съвет (кабинет Желязков)"],
  "nk-27-2026": ["депутати", "Искра Михайлова и група народни представители (ДПС)"],
  "nk-32-2026": [null, "Обединен законопроект"],
  "zchr-21-2021": ["МС", "Министерски съвет (кабинет Борисов III)"],
  "zchr-67-2023": ["МС", "Министерски съвет (кабинет Денков)"],
  "zchr-39-2024": ["депутати", "Маноил Манев и Теменужка Петкова (ГЕРБ)"],
  "zzo-21-2021": ["депутати", "Даниела Дариткова и още 6 народни представители"],
  "zzo-32-2022": ["депутати", "Антон Тонев и още 5 народни представители"],
  "zzo-13-2023": ["депутати", "Васил Пандов, Костадин Ангелов, Лъчезар Иванов, Асен Василев, Кирил Петков и Калина Константинова"],
  "zzo-64-2023": ["депутати", "Костадин Ангелов (ГЕРБ)"],
  "zzo-82-2023": ["депутати", "Васил Пандов и Костадин Ангелов (ГЕРБ)"],
  "zzo-13-2024": [null, "Обединен законопроект"],
  "zzo-64-2025": ["депутати", "Драгомир Стойнев и още 4 народни представители"],
  "zzo-97-2025": ["МС", "Министерски съвет (кабинет Желязков)"],
};

const ams = JSON.parse(readFileSync("data/amendments.json", "utf8"));
let nVotes = 0, nVnos = 0;
const out = ams.map((a) => {
  if (a.detailLevel !== "basic" || !VN[a.id]) return a;
  const r = { ...a };
  const [vtype, vnos] = VN[a.id];
  r.vnositel = vnos;
  if (vtype) r.vnositelType = vtype;
  nVnos++;
  const b = bills[a.id];
  if (b) r.billUrl = `https://www.parliament.bg/bg/bills/ID/${b.billId}`;
  const vd = votesData[a.id];
  if (vd) {
    r.votes = vd.votes;
    r.votesByParty = normVotes(vd.votesByParty);
    r.votesVerified = true;
    r.stenogramLink = vd.stenUrl;
    nVotes++;
  } else if (totalsOnly[a.id]) {
    r.votes = totalsOnly[a.id].votes;
    r.votesVerified = "partial";
    r.stenogramLink = totalsOnly[a.id].sten;
    nVotes++;
  }
  return r;
});
writeFileSync("data/amendments.json", JSON.stringify(out, null, 2) + "\n");
console.log(`vnositel: ${nVnos} | votes: ${nVotes}`);
