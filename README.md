# Зад Закона — историята на промените в българските закони

> Сайтът е vibe-coded с Muse Spark 1.3 (с AI помощ).
> Данните се сверяват с официални източници, но кодът и текстовете
> може да съдържат неточности. Намериш ли грешка — кажи ни.

🌐 **Live:** https://zad-zakona.com
📦 **Repo:** https://github.com/ligaz/zad-zakona

Статичен сайт (Next.js, `output: "export"`) — без база и без сървъри.
Деплой: всеки push в `master` → GitHub Actions build → GitHub Pages
(`.github/workflows/deploy.yml`). PR-ите минават CI проверки
(`.github/workflows/ci.yml`).

## Структура

```text
app/
  page.tsx                 Начална: hero + кутии + feed (последни 10)
  layout.tsx               Root layout, SEO metadata, viewport
  icon.svg                 Favicon (§ върху парламентарно синьо)
  opengraph-image.tsx      OG картинка 1200×630 (генерира се при build)
  sitemap.ts / robots.ts   Генерират се при build
  zakoni/page.tsx          Списък закони (client, лек bundle)
  zakoni/[id]/page.tsx     Закон + timeline на измененията
  aktove/page.tsx          Индекс на актовете (client, лек bundle)
  promeni/[id]/page.tsx    Детайл на изменение/решение
  metodologiya/page.tsx    Как работим
components/
  Filters.tsx              FilterSearch, FilterChip, FilterChipRow (единствени!)
  Viz.tsx                  ActCard, PageHeader, VoteBar, ContextBadge, PartyBreakdown
  LegislativePath.tsx      Пътят на акта (Приет → Указ → ДВ → В сила)
  ParliamentChart.tsx      Зала 240 места (геометрията е фиксирана!)
  CoalitionDots.tsx        Точки на коалицията
  Header.tsx               Header + Footer
lib/
  data.ts                  Loader + helpers (само за сървъра!)
  types.ts                 Типове + HIDDEN_LAW_IDS
  parties.ts               Цветове и подредба на партиите (единствен източник)
  site.ts                  SITE_URL (https://zad-zakona.com)
data/
  laws.json                183 закона (8 групи решения/ратификации са скрити от /zakoni)
  amendments.json          1542 курирани детайла (verified, shortTitle, summary, changes, votes)
  acts-index.json          3879 записа от parliament.bg API (+detailId/card полета за картите)
  assemblies.json          НС 40–52: управляващи, премиер, президент
docs/
  ui-components.md         Задължителни правила за UI компоненти
  data-pipeline.md         Извличане и сверка на данни
  parliament-chart.md      Спецификация на залата (НЕ се пипа без одобрение)
scripts/
  check-dv.mjs             Седмична проверка за нови броеве на ДВ (npm run check:dv)
  enumerate-acts.mjs       Изброяване на актове от parliament.bg API
  fetch-act-details.mjs    Вотове, вносители, стенограми
  resolve-dv-mat.mjs       Истински ДВ idMat връзки
  merge-curated.mjs        Merge на курирани закони/решения
  ...                      Виж docs/data-pipeline.md за пълния процес
```

## Правила (задължителни)

1. Нов филтърен UI или картичка — само общите компоненти (виж
   `docs/ui-components.md`). Без локални копия.
2. Клиентските страници импортират директно малките JSON файлове,
   **никога** `@/lib/data` (~6.5MB в bundle-а чупи мобилните устройства).
3. Всеки цветови клас носи `dark:` двойник. Акцентът е token `accent`.
4. Само проверени данни от първични източници (parliament.bg, ДВ).
   Никога измислени вотове, дати или мотиви.

## Команди

```bash
npm run dev          # dev сървър → http://localhost:4000
npm run build        # статичен export в out/
npm run lint         # eslint (0 errors)
npm run check:dv     # нови броеве на ДВ + покритие
```

## Седмично обновяване

```bash
npm run check:dv
```

После по чеклиста, който скриптът принтира: сверка на ДВ текста,
мотивите и стенограмата → нов обект в `data/amendments.json` →
`npm run build` → push (deployment-ът е автоматичен).

## Лиценз

MIT — виж [LICENSE](LICENSE).
