import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE, SITE_URL, EMAIL, mainJsonLd } from "@/lib/site";
import { faqJsonLd } from "@/lib/faq";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE.name,
  description: SITE.description,
  applicationName: "Chat with Islam Hafez",
  authors: [{ name: "Islam Hafez", url: `mailto:${EMAIL}` }],
  creator: "Islam Hafez",
  publisher: "Islam Hafez",
  category: "technology",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "profile",
    url: SITE_URL,
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    firstName: "Islam",
    lastName: "Hafez",
    username: "islamhafez0",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Islam Hafez — Odoo ERP developer and frontend engineer, Cairo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.description,
    images: ["/opengraph-image"],
    site: "@islamhafez0",
    creator: "@islamhafez0",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.svg",
  },
  verification: { google: googleVerification },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#080D18" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = [mainJsonLd(), faqJsonLd()];
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <link rel="me" href="https://islamhafez.vercel.app" />
        <link rel="me" href="https://github.com/islamhafez0" />
        <link rel="me" href="https://www.linkedin.com/in/islamhafez0" />
        <link rel="me" href="https://x.com/islamhafez0" />
        <link rel="me" href="https://dev.to/islamhafez0" />
      </head>
      <body
        className={cn(
          "min-h-dvh bg-background font-sans text-foreground antialiased",
          sans.variable,
          mono.variable,
          display.variable,
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
