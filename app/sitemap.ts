import type { MetadataRoute } from "next";
import { amendments, laws } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/zakoni`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/aktove`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/metodologiya`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
  for (const l of laws) {
    pages.push({
      url: `${SITE_URL}/zakoni/${l.id}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }
  for (const a of amendments) {
    pages.push({
      url: `${SITE_URL}/promeni/${a.id}`,
      lastModified: a.dateDV ?? a.dateAdopted ?? now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }
  return pages;
}
