# Зад Закона — историята на промените в българските закони

> Сайтът е vibe-coded с Muse Spark 1.3 (с AI помощ).
> Данните се сверяват с официални източници, но кодът и текстовете
> може да съдържат неточности. Намериш ли грешка — кажи ни.

Статичен сайт (Next.js, `output: "export"`) — без база, безплатен хостинг
(GitHub Pages / Cloudflare Pages / Netlify / Vercel).

## Данни

Живеят в `data/` като JSON — преглеждаеми в git, обновяват се ръчно/полуавтоматично:

- `data/assemblies.json` — НС-та 40–52: управляващи, премиер, президент
- `data/laws.json` — закони + списък с изменения (нови → стари)
- `data/amendments.json` — всяко изменение: ДВ, дати, вносител, мотиви,
  гласуване, diff преди/след, `verified` флаг и `sources` (ДВ/законопроект/новини)

`lib/data.ts` е само loader + helpers. Типове: `lib/types.ts`.

## Седмично обновяване

```bash
npm run check:dv   # показва новите броеве на ДВ + покритието в data/
```

После по чеклиста, който скриптът принтира: сверка на ДВ текста, мотивите
и стенограмата → нов обект в `data/amendments.json` → `npm run build` → push.

## Getting Started (Next.js)

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
