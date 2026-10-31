import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getPhotos } from "@/lib/photos";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-10-31");
  const photos = getPhotos();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      images: [
        ...photos.map(p => `${SITE_URL}${p.src}`),
        `${SITE_URL}/opengraph-image`,
      ],
    },
    // CVs are not yet published — uncomment when ready:
    // {
    //   url: `${SITE_URL}/files/islam-hafez-odoo.pdf`,
    //   lastModified,
    //   changeFrequency: "yearly",
    //   priority: 0.5,
    // },
    // {
    //   url: `${SITE_URL}/files/islam-hafez-frontend.pdf`,
    //   lastModified,
    //   changeFrequency: "yearly",
    //   priority: 0.5,
    // },
  ];
}
