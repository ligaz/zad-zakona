import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Закони",
  description:
    "Всички български закони по азбучен ред — всеки с историята на измененията си: какво се промени, кой гласува и кой управляваше.",
  alternates: { canonical: "/zakoni" },
  openGraph: {
    type: "website",
    url: "/zakoni",
    title: "Закони",
    description:
      "Всички български закони по азбучен ред — всеки с историята на измененията си.",
  },
};

export default function ZakoniLayout({ children }: { children: React.ReactNode }) {
  return children;
}
