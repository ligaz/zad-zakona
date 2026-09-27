import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Актове от 2021 насам",
  description:
    "Всички приети актове на Народното събрание от 2021 насам — закони, изменения и решения, с гласувания и връзки към Държавен вестник.",
  alternates: { canonical: "/aktove" },
  openGraph: {
    type: "website",
    url: "/aktove",
    title: "Актове от 2021 насам",
    description:
      "Всички приети актове на Народното събрание от 2021 насам — с гласувания и връзки към Държавен вестник.",
  },
};

export default function AktoveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
