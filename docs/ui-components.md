# UI компоненти — правила (задължителни)

## Общи компоненти

Всички споделени UI компоненти живеят в `components/` и се преизползват —
**не се копира markup между страници**:

| Компонент | Файл | Ползване |
|---|---|---|
| `FilterSearch`, `FilterChip`, `FilterChipRow` | `components/Filters.tsx` | Всички филтри (/zakoni, /aktove, бъдещи) |
| `PageHeader` | `components/Viz.tsx` | Заглавна секция на списъчните страници (еднакъв eyebrow/H1/описание/отстояния) |
| `ActCard` | `components/Viz.tsx` | Картички с актове (начална, /aktove) |
| `VoteBar`, `ContextBadge`, `PartyBreakdown` | `components/Viz.tsx` | Гласувания и контекст |
| `LegislativePath` | `components/LegislativePath.tsx` | Пътят на акта |
| `ParliamentChart` | `components/ParliamentChart.tsx` | Зала (геометрията е фиксирана — виж `docs/parliament-chart.md`) |
| `CoalitionDots` | `components/CoalitionDots.tsx` | Точки на коалицията (цветове от `lib/parties.ts`) |

## Правила

1. Нов филтърен UI = `FilterSearch` + `FilterChipRow` + `FilterChip` от
   `components/Filters.tsx`. Без локални копия на стиловете.
2. Нова списъчна страница = `PageHeader` (eyebrow + H1 с брой + описание)
   в `<section className="py-8">`, после филтрите. Без локални вариации
   на шрифтове и отстояния.
2. Нова картичка за акт = `ActCard`. Без локален дублиращ markup.
3. Промяна в общ компонент се отразява навсякъде — провери всички ползвания
   (`grep` за името) преди да я направиш.
4. Акцентният цвят е theme token `accent` (`#1e3a8a`, дефиниран в
   `app/globals.css`). Не се ползват директни `blue-*` класове за акценти.
   За текст върху тъмен фон: `accentlight` (`dark:text-accentlight`).
5. Клиентският bundle е критичен за мобилни устройства: клиентските
   страници импортират директно малките JSON файлове (`@/data/laws.json`,
   `@/data/acts-index.json`), **никога** barrel-а `@/lib/data` (дърпа
   ~6.5MB amendments+index и чупи интеракциите на телефон).
6. Тъмен режим: всеки цветови клас носи `dark:` двойник
   (`text-zinc-600` → `dark:text-zinc-400`, `bg-white` →
   `dark:bg-zinc-900`, `border-zinc-200` → `dark:border-zinc-700` и т.н.).
   Без изключения — проверява се със screenshot в dark mode.

## Документи

- `docs/data-pipeline.md` — извличане и сверка на данни.
- `docs/parliament-chart.md` — спецификация на залата (фиксирана геометрия).
- Този файл — споделени UI компоненти.
