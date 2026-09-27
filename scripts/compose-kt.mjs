/** Пълен ъпгрейд на КТ: 6 verified full entries. Данни: parliament.bg API + стенограми + ДВ. */
import { readFileSync, writeFileSync } from "node:fs";

const N = {
  "ГЕРБ-СДС": "ГЕРБ-СДС", "ГЕРБ - СДС": "ГЕРБ-СДС",
  "ПП": "ПП", "ПП-ДБ": "ПП-ДБ", "ПП - ДБ": "ПП-ДБ", "ДБ": "ДБ",
  "ДПС": "ДПС", "ДПС - НН": "ДПС", "БСП": "БСП", "БСП - ОЛ": "БСП",
  "ИТН": "ИТН", "ВЪЗРАЖДАНЕ": "Възраждане", "Възраждане": "Възраждане",
  "БВ": "БВ", "НЕЗ": "независими", "НЕЧЛ В ПГ": "независими",
  "АПС": "АПС", "МЕЧ": "МЕЧ", "ВЕЛИЧИЕ": "Величие",
};
const norm = (list) => list.map((p) => ({ party: N[p.party] || p.party, za: p.za, protiv: p.protiv, vazdrzhal: p.vazdrzhal }));
const V = (f) => JSON.parse(readFileSync(f, "utf8"));

const v62 = V("/tmp/v2-47-2022-07-28.json");
const v14 = V("/tmp/v2-48-2023-02-01.json");
const v85 = V("/tmp/v2-49-2023-09-26.json");
const v27 = V("/tmp/v2-49-2024-03-14.json");
const v66 = V("/tmp/v2-50-2024-07-25.json");
const v115 = V("/tmp/v2-51-2025-12-18.json");

const FULL = [
  {
    id: "kt-62-2022", lawId: "kodeks-truda",
    shortTitle: "Баланс работа–семейство: 2 месеца отпуск за бащи",
    dv: "ДВ, бр. 62/2022", dateAdopted: "2022-07-28", assemblyId: "47-ns",
    dateDecree: "2022-08-01", decreeNo: "№ 217",
    vnositel: "Министерски съвет (Петков)", vnositelType: "МС",
    motives: "Правителството транспонира европейските директиви за баланс между работа и личен живот и за предвидими условия на труд (2019/1158, 2019/1152) — записано в §10 на самия закон.",
    detailLevel: "full", verified: true, votesVerified: true,
    stenogramLink: v62.stenUrl,
    votes: v62.votes, votesByParty: norm(v62.votesByParty),
    changes: [
      { member: "чл. 164в (нов)", before: "Няма специален отпуск за бащи за отглеждане на дете.", after: "„Бащата (осиновителят) има право на отпуск за отглеждане на дете до 8-годишна възраст в размер на два месеца... Времето се признава за трудов стаж.“", plain: "Бащите получават 2 месеца платен отпуск за дете до 8 години." },
      { member: "чл. 167б", before: "Ограничени права за гъвкаво работно време на родители.", after: "„Родител на дете до 8 г. може писмено да поиска непълно време, работа от разстояние и други улеснения за съвместяване на трудовите и семейните задължения.“", plain: "Родителите на малки деца могат да поискат гъвкаво работно време или home office." },
      { member: "чл. 119", before: "Няма право да искаш постоянен договор.", after: "„Работник на срочен/непълен договор може писмено да поиска безсрочен/пълен. При отказ работодателят дължи мотивиран писмен отговор до 1 месец.“", plain: "На временен договор можеш да поискаш постоянен — шефът трябва да ти отговори писмено." },
      { member: "чл. 70", before: "Срок за изпитване до 6 месеца и при кратки договори.", after: "„Когато работата е за срок по-кратък от година — срокът за изпитване е до един месец.“", plain: "При краткосрочна работа пробацията е максимум месец." },
    ],
    summary: "2 месеца отпуск за бащи, гъвкаво време за родители и таван на пробацията — европейски директиви.",
    tags: ["родители", "ЕС", "пробация"],
    sources: { bill: "https://www.parliament.bg/bg/laws/ID/164202" },
  },
  {
    id: "kt-14-2023", lawId: "kodeks-truda",
    shortTitle: "Минималната заплата — 50% от средната",
    dv: "ДВ, бр. 14/2023", dateAdopted: "2023-02-01", assemblyId: "48-ns",
    dateDecree: "2023-02-07", decreeNo: "№ 35",
    vnositel: "Корнелия Нинова и група народни представители (БСП)", vnositelType: "депутати",
    motives: "От дебата в зала: минималната заплата да е предвидима и вързана за средната — „как се определя тя и дали има предвидимост за бизнеса и за работниците“ (Деница Сачева, ГЕРБ-СДС). Прието със 146 „за“ без нито един „против“.",
    detailLevel: "full", verified: true, votesVerified: true,
    stenogramLink: v14.stenUrl,
    votes: v14.votes, votesByParty: norm(v14.votesByParty),
    changes: [
      { member: "чл. 244", before: "Минималната заплата се определя без ясна формула.", after: "„Минималната заплата за следващата година се определя до 1 септември в размер на 50% от средната брутна заплата за 12 месеца — и не може да пада под миналогодишната.“", plain: "Минималната заплата е половината от средната и се знае още през септември." },
    ],
    summary: "Минималната заплата става 50% от средната и се обявява до 1 септември — прието без нито един глас „против“.",
    tags: ["заплати"],
    sources: { bill: "https://www.parliament.bg/bg/laws/ID/164359" },
  },
  {
    id: "kt-85-2023", lawId: "kodeks-truda",
    shortTitle: "Край на хартиената трудова книжка",
    dv: "ДВ, бр. 85/2023", dateAdopted: "2023-09-26", assemblyId: "49-ns",
    dateDecree: "2023-10-03", decreeNo: "№ 181",
    vnositel: "Божидар Божанов и група народни представители (ДБ/ПП)", vnositelType: "депутати",
    detailLevel: "full", verified: true, votesVerified: true,
    stenogramLink: v85.stenUrl,
    votes: v85.votes, votesByParty: norm(v85.votesByParty),
    changes: [
      { member: "чл. 62", before: "Работодателят изпраща хартиено уведомление до НАП при всеки договор.", after: "„...впише данните в регистъра на заетостта“ — вместо уведомления вече има електронно вписване.", plain: "Няма повече бланки до НАП — договорът се вписва електронно." },
      { member: "чл. 226", before: "Санкция за „незаконно задържане на трудовата книжка“.", after: "„...невписване на прекратяването на договора по реда на чл. 62, ал. 3.“", plain: "Глобата вече е за невписан край на договора, не за задържана книжка." },
      { member: "глава 17 + чл. 347", before: "Хартиена трудова книжка + регистър на договорите.", after: "„НАП поддържа регистър на заетостта, който съдържа единните електронни трудови записи.“", plain: "Трудовата книжка става електронен запис в НАП — стажът ти е защитен." },
    ],
    summary: "Хартиената трудова книжка отива в историята — всичко става електронен запис в регистър на заетостта.",
    tags: ["дигитализация", "стаж"],
    sources: { bill: "https://www.parliament.bg/bg/laws/ID/164801", dv: "https://dv.parliament.bg/DVWeb/showMaterialDV.jsp?idMat=199995" },
  },
  {
    id: "kt-27-2024", lawId: "kodeks-truda",
    shortTitle: "Home office с няколко бюра и защита от алгоритми",
    dv: "ДВ, бр. 27/2024", dateAdopted: "2024-03-14", assemblyId: "49-ns",
    dateDecree: "2024-03-25", decreeNo: "№ 81",
    vnositel: "Министерски съвет (Денков)", vnositelType: "МС",
    detailLevel: "full", verified: true, votesVerified: true,
    stenogramLink: v27.stenUrl,
    votes: v27.votes, votesByParty: norm(v27.votesByParty),
    changes: [
      { member: "чл. 107з", before: "Едно работно място от разстояние; алгоритмите — черна кутия.", after: "„Може да се уговаря повече от едно място на работа... При алгоритмично управление работодателят дава писмена информация как се взимат решенията и е длъжен да провери решението при искане.“", plain: "Можеш да работиш от няколко места, а ако алгоритъм решава вместо шефа — имаш право на обяснение и проверка." },
      { member: "чл. 107и", before: "„в дома си или избрано друго помещение“.", after: "„работно място извън предприятието към датата на възникване или изменение на правоотношението.“", plain: "Дефиницията за дистанционна работа е осъвременена." },
    ],
    summary: "Дистанционната работа с няколко места и първите правила срещу „алгоритмичен шеф“.",
    tags: ["home office", "алгоритми"],
    sources: { bill: "https://www.parliament.bg/bg/laws/ID/165216" },
  },
  {
    id: "kt-66-2024", lawId: "kodeks-truda",
    shortTitle: "Бащите наследяват майчинството при трагедия",
    dv: "ДВ, бр. 66/2024", dateAdopted: "2024-07-25", assemblyId: "50-ns",
    dateDecree: "2024-08-01", decreeNo: "№ 190",
    vnositel: "Деница Сачева и група народни представители (ГЕРБ-СДС)", vnositelType: "депутати",
    detailLevel: "full", verified: true, votesVerified: true,
    stenogramLink: v66.stenUrl,
    votes: v66.votes, votesByParty: norm(v66.votesByParty),
    votesNote: "Приет по спешност (чл. 76, ал. 2 от правилника) — двете четения в едно заседание на 25.07.2024; единодушно 159/0/0.",
    changes: [
      { member: "чл. 167", before: "Тесен кръг случаи, в които бащата ползва остатъка от майчинството.", after: "„Когато майката на дете до 2 г. почине или заболее тежко, или е лишена от родителски права — съответната част от отпуските се ползват от бащата (осиновителя).“", plain: "При смърт, тежка болест или отнети права на майката — бащата взима остатъка от майчинството." },
    ],
    summary: "Бащите получават остатъка от майчинството при смърт, тежка болест или отнети права на майката — единодушно.",
    tags: ["родители"],
    sources: { bill: "https://www.parliament.bg/bg/laws/ID/165614" },
  },
  {
    id: "kt-115-2025", lawId: "kodeks-truda",
    shortTitle: "Прагът 8 → 12 години",
    dv: "ДВ, бр. 115/2025", dateAdopted: "2025-12-18", assemblyId: "51-ns",
    dateDecree: "2025-12-23", decreeNo: "№ 274",
    vnositel: "Деница Сачева и група народни представители (ГЕРБ-СДС)", vnositelType: "депутати",
    detailLevel: "full", verified: true, votesVerified: true,
    stenogramLink: v115.stenUrl,
    votes: v115.votes, votesByParty: norm(v115.votesByParty),
    changes: [
      { member: "чл. 167б, ал. 1", before: "„8-годишна“.", after: "„12-годишна“.", plain: "Възрастовият праг в чл. 167б се вдига от 8 на 12 години." },
    ],
    summary: "Прагът в чл. 167б (права за съвместяване на труд и семейство) се вдига от 8 на 12 години.",
    tags: ["родители"],
    sources: { bill: "https://www.parliament.bg/bg/laws/ID/166631" },
  },
];

const ams = JSON.parse(readFileSync("data/amendments.json", "utf8"));
const drop = new Set(["kt-62-2022", "kt-14-2023", "kt-27-2024", "kt-66-2024", "kt-115-2025", "kt-85-2023"]);
const merged = [...ams.filter((a) => !drop.has(a.id)), ...FULL];
writeFileSync("data/amendments.json", JSON.stringify(merged, null, 2) + "\n");

const laws = JSON.parse(readFileSync("data/laws.json", "utf8"));
const byDate = Object.fromEntries(merged.map((a) => [a.id, a.dateAdopted]));
const out = laws.map((l) => {
  if (l.id !== "kodeks-truda") return l;
  const ids = ["kt-115-2025", "kt-66-2024", "kt-27-2024", "kt-85-2023", "kt-14-2023", "kt-62-2022", "kt-2020-covid", "kt-2011-bolnichni"];
  return { ...l, amendments: ids.sort((x, y) => byDate[y].localeCompare(byDate[x])) };
});
writeFileSync("data/laws.json", JSON.stringify(out, null, 2) + "\n");
console.log("KT full done. total:", merged.length);
