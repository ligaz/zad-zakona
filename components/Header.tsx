import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-lg font-black text-white">
            §
          </span>
          <span className="leading-tight">
            <span className="block text-base font-extrabold tracking-tight text-zinc-900">
              Зад Закона
            </span>
            <span className="block text-xs text-zinc-500">
              историята на българските закони
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-zinc-600">
          <Link href="/zakoni" className="hover:text-accent">
            Закони
          </Link>
          <Link href="/aktove" className="hover:text-accent">
            Актове
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-zinc-500">
        <p className="font-semibold text-zinc-700">Зад Закона</p>
        <p className="mt-1 max-w-2xl">
          Всички данни са сверени с официални източници — отбелязваме кое е
          пълно и кое е кратка справка в процес на допълване. Официални
          източници: parliament.bg (законопроекти, стенограми, гласувания) и
          dv.parliament.bg (Държавен вестник).
        </p>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/" className="underline hover:text-zinc-800">
            Начало
          </Link>
          <Link href="/zakoni" className="underline hover:text-zinc-800">
            Закони
          </Link>
          <Link href="/aktove" className="underline hover:text-zinc-800">
            Актове
          </Link>
          <Link href="/metodologiya" className="underline hover:text-zinc-800">
            Как работим — как събираме и проверяваме данните →
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-zinc-800"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
