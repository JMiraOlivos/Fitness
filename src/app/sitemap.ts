import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

// Only public, indexable routes. Authenticated pages (/entrenar, /progreso, /perfil,
// /admin, dynamic ids) are intentionally excluded — they require a session and carry
// no SEO value.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/auth"];

  return routes.map((route) => ({
    url: `${siteUrl}${route === "/" ? "" : route}`,
    lastModified: new Date("2026-07-12"),
    changeFrequency: "monthly" as const,
    priority: route === "/" ? 1 : 0.5,
  }));
}
