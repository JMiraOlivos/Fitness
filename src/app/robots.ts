import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated/private areas add no SEO value and shouldn't be crawled.
      disallow: ["/admin", "/api", "/perfil", "/onboarding"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
