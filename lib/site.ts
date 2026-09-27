/** Домейнът на сайта. Може и през env: NEXT_PUBLIC_SITE_URL */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://zad-zakona.com";

export const SITE_NAME = "Зад Закона";
export const SITE_TAGLINE = "историята на промените в българските закони";
export const SITE_DESCRIPTION =
  "Всяка промяна на всеки закон: какво се промени, защо, кой гласува и кой управляваше тогава. Просто, визуално, за всеки.";
