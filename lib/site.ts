/** Central site identity + person facts for metadata, robots, sitemap and JSON-LD. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://ai-islamhafez.vercel.app"
).replace(/\/+$/, "");

export const SITE = {
  url: SITE_URL,
  name: "Islam Hafez — Builds ERP Systems on Odoo | Frontend Developer",
  description:
    "I build complete ERP systems on Odoo 17/19: apiary management, disaster response, humanitarian storefronts and a paid Odoo Apps module — plus fast React, Next.js and TypeScript frontends. Chat with an AI assistant grounded in my real work.",
  locale: "en",
} as const;

export const EMAIL = "islamhafez806@gmail.com";
export const PHONE = "+20 10 9742 3297";

export const PERSON = {
  name: "Islam Hafez",
  jobTitle: "Odoo ERP Systems Builder & Frontend Developer (React, Next.js)",
  description:
    "Builds complete ERP systems on Odoo 17/19 with Python, OWL and PostgreSQL — apiary management, disaster response, humanitarian e-commerce, SaaS provisioning — plus production frontends with React, Next.js, TypeScript and Angular 17.",
  image: `${SITE_URL}/images/islam-hafez-professional.png`,
  location: "Cairo (Maadi), Egypt",
  email: EMAIL,
  phone: PHONE,
} as const;

export const SOCIALS = [
  { label: "GitHub", url: "https://github.com/islamhafez0" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/islamhafez0" },
  { label: "X (Twitter)", url: "https://x.com/islamhafez0" },
  { label: "Instagram", url: "https://www.instagram.com/islamhafez0" },
  { label: "Facebook", url: "https://www.facebook.com/islamhafez0" },
  { label: "DEV Community", url: "https://dev.to/islamhafez0" },
  { label: "Medium", url: "https://medium.com/@islamhafez0" },
  { label: "Hashnode", url: "https://islamhafez.hashnode.dev" },
  { label: "Portfolio", url: "https://islamhafez.vercel.app" },
  { label: "Nafzly", url: "https://nafzly.com/u/islam_hafez" },
] as const;

/** Structured data graph: WebSite + Person on a ProfilePage. */
export function mainJsonLd(): object {
  const personId = `${SITE_URL}/#islam-hafez`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE.name,
        alternateName: "Chat with Islam Hafez",
        description: SITE.description,
        inLanguage: "en",
        publisher: { "@id": personId },
      },
      {
        "@type": "ProfilePage",
        "@id": `${SITE_URL}/#profile-page`,
        url: `${SITE_URL}/`,
        name: SITE.name,
        inLanguage: "en",
        mainEntity: { "@id": personId },
        about: { "@id": personId },
      },
      {
        "@type": "Person",
        "@id": personId,
        name: PERSON.name,
        jobTitle: PERSON.jobTitle,
        description: PERSON.description,
        image: PERSON.image,
        url: `${SITE_URL}/`,
        email: `mailto:${EMAIL}`,
        telephone: PERSON.phone,
        knowsLanguage: ["Arabic (native)", "English (professional)"],
        worksFor: [
          {
            "@type": "Organization",
            name: "TaqaTechno",
            roleName: "Odoo ERP & Frontend Developer",
          },
          { "@type": "Organization", name: "Self-Employed (Freelance)" },
        ],
        alumniOf: { "@type": "CollegeOrUniversity", name: "Damanhour University" },
        address: {
          "@type": "PostalAddress",
          addressLocality: "Cairo",
          addressRegion: "Cairo Governorate",
          addressCountry: "EG",
        },
        sameAs: SOCIALS.map((s) => s.url),
        hasOccupation: {
          "@type": "Occupation",
          name: "Odoo ERP Developer and Frontend Engineer",
          occupationalCategory: "15-1257.00",
          skills: [
            "Odoo ERP",
            "Python",
            "OWL",
            "QWeb",
            "React",
            "Next.js",
            "TypeScript",
            "PostgreSQL",
          ],
        },
        knowsAbout: [
          "Odoo ERP systems",
          "Odoo 17",
          "Odoo 19",
          "Custom Odoo modules",
          "OWL (Odoo Web Library)",
          "QWeb",
          "Odoo Apps store",
          "React.js",
          "Next.js",
          "TypeScript",
          "Angular 17",
          "NgRx",
          "Python",
          "PostgreSQL",
          "pgvector",
          "Retrieval-Augmented Generation",
          "Tailwind CSS",
          "Web performance",
          "Figma",
          "Shopify Liquid",
        ],
      },
    ],
  };
}
