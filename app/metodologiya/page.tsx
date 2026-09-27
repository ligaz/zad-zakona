import type { Metadata } from "next";
import Link from "next/link";
import { verifiedCount, visibleAmendments, visibleLaws } from "@/lib/data";

export const metadata: Metadata = {
  title: "Как работим",
  description:
    "Как събираме и проверяваме данните в Зад Закона: parliament.bg, стенограми, гласувания и Държавен вестник.",
  alternates: { canonical: "/metodologiya" },
  openGraph: {
    type: "article",
    url: "/metodologiya",
    title: "Как работим",
    description:
      "Как събираме и проверяваме данните в Зад Закона: parliament.bg, стенограми, гласувания и Държавен вестник.",
  },
};

export default function Metodologiya() {
  return (
    <div className="max-w-2xl pb-10">
      <p className="pt-6 text-sm text-zinc-500">
        <Link href="/" className="hover:underline">← Начало</Link>
      </p>
      <h1 className="mt-4 text-3xl font-black">Как работим</h1>
      <p className="mt-2 text-zinc-600">
        Откъде идва всяка цифра на тази страница — и как се обновява сайтът.
      </p>

      <h2 className="mt-8 font-bold">1. Безплатно и бързо</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700">
        Законите се променят рядко (нов брой на Държавен вестник излиза няколко
        пъти седмично). Затова сайтът няма скъпи сървъри и бази данни — цялата
        информация се пази в обикновени файлове и сайтът се обновява при всяка
        промяна. Това означава безплатна поддръжка и мигновено зареждане.
      </p>

      <h2 className="mt-6 font-bold">2. Официални източници</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
        <li><b>parliament.bg → Законопроекти:</b> кой внася закона, мотивите, номерът му, комисии, доклади.</li>
        <li><b>parliament.bg → Закони:</b> кога е приет и кой законопроект стои зад него.</li>
        <li><b>dv.parliament.bg → Държавен вестник:</b> официалният текст на промените — сравняваме го член по член („преди“ и „сега“).</li>
        <li><b>parliament.bg → Стенограми и гласувания:</b> кой как е гласувал, по партии.</li>
        <li><b>Политически контекст:</b> ръчно поддържан списък кое Народно събрание, правителство, премиер и президент са управлявали тогава.</li>
      </ul>

      <h2 className="mt-6 font-bold">3. Обновяване всяка седмица</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
        <li>Всяка неделя проверяваме новите броеве на Държавен вестник.</li>
        <li>Новите промени се изтеглят автоматично, а човек ги преглежда една по една.</li>
        <li>За всяка промяна пишем обяснение на прост език.</li>
        <li>Сайтът се обновява автоматично — безплатно.</li>
      </ol>

      <h2 className="mt-6 font-bold">4. Какво има днес?</h2>
      <p className="mt-2 text-sm text-zinc-700">
        {visibleLaws.length} закона и {visibleAmendments.length} изменения, от които {verifiedCount} са сверени с
        Държавен вестник (зелен знак „✓ Проверено“). Всяка страница
        показва историята на промените, сравнение „преди/сега“, гласуването по
        партии и политическия контекст. Гласуванията водят към официалната
        стенограма, а всеки акт — към броя си в Държавен вестник. Отделен
        индекс с всички приети актове от 2021 насам (включително решения и
        ратификации) има на страницата „Актове“.
      </p>

      <h2 className="mt-6 font-bold">5. Какво следва</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
        <li>Пълно сравнение по членове за всеки закон.</li>
        <li>Известия по имейл „твоят закон се промени“.</li>
        <li>Търсене и филтри по депутат-вносител.</li>
      </ul>

      <h2 className="mt-6 font-bold">6. Кой направи сайта?</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700">
        Сайтът е направен с помощта на изкуствен интелект
        (Muse Spark 1.3). Данните сверяваме с официални източници, но
        в текстовете и кода може да има неточности. Ако забележиш грешка —
        пиши ни, оправяме я.
      </p>
    </div>
  );
}
