import { FAQ_ENTRIES } from "@/lib/faq";
import { SITE_URL, EMAIL, PHONE, SOCIALS } from "@/lib/site";
import { getPhotos } from "@/lib/photos";
import { cn } from "@/lib/utils";


const erpProjects = [
  {
    name: "Apiary and Honey — apiary management ERP",
    meta: "Odoo 17 · Python · QWeb · SCSS · private TaqaTechno repo",
    paragraphs: [
      "A full ERP for beekeeping businesses: sites, colonies, batches, seasons, inspections, feeding, treatments, extractions, harvests, colony movements and permits, mortality tracking, apiary cost accounting, and field data capture. Designed for traceability, compliance, and bilingual Arabic/English operations.",
      "268 of the repository's 275 commits are mine. I shipped it as 31 merged work packages into an integration trunk — dev → stage → main through reviewed pull requests. The test suite reached 572 automated tests before a manual walkthrough that found five further defects; role-based access covers four user groups, and the field app runs in English, Arabic, and Russian.",
    ],
  },
  {
    name: "Relief Center — disaster-response platform",
    meta: "Odoo 19 · Python · OWL · MapTiler SDK · reliefcenter.com",
    paragraphs: [
      "Live at reliefcenter.com. Real-time emergencies from NASA, USGS, and GDACS stream into Odoo's ORM; the OWL frontend renders them on an interactive 3D globe built with the MapTiler SDK. Field coordinators get OTP-secured alerts and a CRM workflow for response-team coordination.",
      "The main engineering challenge was feeding high-frequency geospatial data into Odoo's monolithic architecture without degrading the rest of the system.",
    ],
  },
  {
    name: "Emdad — humanitarian storefront",
    meta: "Odoo 17 · Python · OWL · PostgreSQL",
    paragraphs: [
      "Extended Odoo's base catalog model for a live humanitarian store: category flags, translatable descriptions, and hero icons so the team can curate the homepage from the ERP. Also implemented role-gated pricing and a B2B quote-to-order flow for partner organizations.",
    ],
  },
  {
    name: "Odoo SaaS tenant provisioning module",
    meta: "Odoo · Python · OWL · merged pull request",
    paragraphs: [
      "Tenants with a full setup-and-teardown lifecycle, scheduled provisioning runs, a SaaS Manager security group with tenant access rules, and a tenant dashboard built with OWL. Merged as PR #1 after review.",
    ],
  },
];

const clientWork = [
  "PearlPixels company website: a website-service module with multi-level menus (removing Odoo's hardcoded two-level menu cap), an RTL carousel, Arabic translations, and WebP lazy image loading. 61 commits.",
  "TaqaT rental site for Qatar: page refactors, routes guarded by website domain, and sitemap fixes. 35 commits.",
  "Soqya: phone-number OTP authentication with portal user registration, plus fixes for security issues in the OTP flow. 28 commits.",
  "Herbal Gardens Shopify store: Core Web Vitals work (image CLS/LCP), a bundle picker, and cart upsell banners that auto-upgrade two 1-packs into a valid 2-pack SKU. 36 commits.",
  "Textile factory ERP rebuild with convention checks and git hooks, plus the website_locked_snippets module.",
];

const frontendProjects = [
  {
    name: "Taqat Admin Panel — fintech operations",
    meta: "Angular 17 · NgRx · TypeScript",
    text: "Platform operations, sponsored user management, device tracking, and settlement management with enforced maker-checker discipline. Built from scratch on a TaqaTechno contract.",
  },
  {
    name: "Taqat Merchant Panel — wallets and payments",
    meta: "Angular 17 · NgRx · AES-256 + HMAC",
    text: "Wallets, top-ups and funding, payouts, and SMS-based payments with OTP. Across both panels: 60+ REST API integrations, every call encrypted with AES-256 + HMAC.",
  },
  {
    name: "RAG Career Chatbot — this site",
    meta: "Next.js 16 · React 19 · TypeScript · pgvector",
    text: "Grounded in a YAML knowledge base, retrieved through pgvector cosine search over 3072-dimension Gemini embeddings, streamed from gemma4:31b. Retrieval Recall@8 of 0.993; 48/48 on the answer eval.",
  },
  {
    name: "Quranik — Quran streaming app",
    meta: "React 19 · Vite · TypeScript",
    text: "Surah search and a glassmorphism player that streams audio straight from the reciter CDN. quranik.vercel.app.",
  },
  {
    name: "Next.js Commerce — e-commerce",
    meta: "Next.js · Sanity · Stripe",
    text: "Full-stack storefront with a Sanity CMS catalog and Stripe checkout.",
  },
  {
    name: "Smaller builds",
    meta: "React · Next.js · .NET · Python",
    text: "A Gemini chat clone with Firebase auth, a YouTube clone on the Data API, a .NET + Angular JWT auth demo, FluxGen AI image generation on the Replicate API, and a Telegram bot that corrects English paragraphs with OpenAI.",
  },
];

const skills = [
  {
    group: "Odoo & ERP",
    items: [
      "Odoo 17/19 customization",
      "Custom modules & APIs (Python)",
      "OWL, QWeb, SCSS",
      "Role-based access design",
      "Automated test suites",
      "Odoo website & eCommerce",
      "Odoo.sh & self-hosted deploys",
    ],
  },
  {
    group: "Frontend",
    items: [
      "React.js",
      "Next.js (App Router)",
      "TypeScript",
      "JavaScript (ES6+)",
      "Angular 17 with NgRx",
      "Tailwind CSS",
      "Framer Motion",
      "shadcn/ui",
      "HTML5 / CSS3 / SCSS",
    ],
  },
  {
    group: "Backend & data",
    items: [
      "PostgreSQL",
      "pgvector & embeddings",
      "REST and GraphQL APIs",
      "Node.js",
      "RAG pipelines",
      "Gemini / OpenAI-compatible LLMs",
    ],
  },
  {
    group: "Others",
    items: [
      "Shopify Liquid",
      "Firebase",
      "Docker",
      "Git & GitHub",
      "Vercel",
      "Figma to pixel-perfect code",
      "Core Web Vitals",
      "Accessibility",
    ],
  },
];

const experience = [
  {
    role: "Odoo Frontend Developer",
    company: "TaqaTechno",
    period: "October 2024 – present",
    text: "Full-time. Custom Odoo modules and APIs in Python, OWL integrations, Figma-to-Odoo themes, and fully custom websites. 439 commits listed across client repositories.",
  },
  {
    role: "Frontend Angular Developer (contract)",
    company: "TaqaTechno",
    period: "June 2025 – September 2025",
    text: "Two enterprise fintech apps built from scratch with Angular 17 and NgRx: 60+ REST API integrations, AES-256 + HMAC encryption on every call, maker-checker settlement flows.",
  },
  {
    role: "Frontend Developer (freelance)",
    company: "Self-Employed",
    period: "August 2024 – present",
    text: "React and Next.js apps, WordPress themes from scratch, e-commerce frontends, and personal portfolios. One project: a secure quiz app with OTP-protected access and session validation.",
  },
  {
    role: "Frontend React Developer Intern",
    company: "Code Alpha",
    period: "April 2024 – August 2024",
    text: "Responsive web apps with React, HTML, and CSS; REST and GraphQL integrations; performance and accessibility habits formed here.",
  },
  {
    role: "SEO Executive",
    company: "New Start Egypt",
    period: "March 2023 – October 2023",
    text: "On-page SEO improvements, content structure, and search visibility for client websites.",
  },
];

const articles = [
  {
    title: "POST /search Is a Lie. HTTP Finally Admits It",
    date: "July 2026",
    url: "https://dev.to/islamhafez0/post-search-is-a-lie-http-finally-admits-it-7jn",
  },
  {
    title: "You Don't Use Linked Lists. But They're Running Half Your Software",
    date: "June 2026",
    url: "https://dev.to/islamhafez0/you-dont-use-linked-lists-but-theyre-running-half-your-software-4b37",
  },
  {
    title: "Monolithic vs Microservices",
    date: "June 2026",
    url: "https://dev.to/islamhafez0/monolithic-vs-microservices-1g3p",
  },
  {
    title: "TOON: Token-Oriented Object Notation — A Complete Guide for LLM Data Efficiency",
    date: "December 2025",
    url: "https://dev.to/islamhafez0/toon-token-oriented-object-notation-a-complete-guide-for-llm-data-efficiency-1ng4",
  },
];

const certifications = [
  { name: "Introduction to Model Context Protocol", issuer: "Anthropic", date: "March 2026", url: "https://verify.skilljar.com/c/rvjwfxhyx7mx" },
  { name: "Introduction to Agent Skills", issuer: "Anthropic", date: "March 2026", url: "https://verify.skilljar.com/c/9kqatya2vv9m" },
  { name: "Building with the Claude API", issuer: "Anthropic", date: "March 2026", url: "https://verify.skilljar.com/c/yv3s3suqeng2" },
  { name: "Claude Code in Action", issuer: "Anthropic", date: "March 2026", url: "https://verify.skilljar.com/c/8gi9q5uogp9a" },
  { name: "Programming with JavaScript", issuer: "Meta on Coursera", date: "January 2024", url: "https://www.coursera.org/verify/ERB6G8PASVYK" },
  { name: "Web Design for Everybody Specialization", issuer: "Coursera", date: "March 2023", url: "https://www.coursera.org/account/accomplishments/specialization/certificate/VL3QG4FBAC3K" },
];

const testimonials = [
  {
    name: "Ashraf Fahmy",
    context: "Marketing Director, Cairoflo · August 2026",
    quote:
      "What stands out most is his combination of technical depth and creative problem-solving. That persistence, paired with his fluency in Python, JavaScript, and Odoo development, made him invaluable.",
  },
  {
    name: "Elena Rostova",
    context: "Freelance PM, Vortex Media · June 2026",
    quote:
      "He is incredibly clear with his updates, asks smart questions early on, and, crucially, never pulls a disappearing act mid-project. He delivered a flawless, mobile-friendly build that hit the design down to the exact pixel.",
  },
  {
    name: "Omar Khaled",
    context: "Founder, PixelCraft Studio · June 2026",
    quote:
      "Islam stands out for his strong attention to detail and practical product thinking. He doesn't just implement tasks, he actively improves user experience when possible. His work on our landing pages was fast, clean, and conversion-focused.",
  },
];

const CHIPS = "rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground";
const SECTION = "mx-auto w-full max-w-3xl px-4 py-14 sm:px-6";
const H2 = "font-display text-3xl tracking-tight text-foreground sm:text-4xl";
const LINK = "text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground transition-[text-decoration-color]";

export function SEOContent() {
  return (
    <div className="relative z-10 flex flex-col border-t border-border/60 bg-background text-base leading-relaxed">

      {/* ── Who I am ──────────────────────────────────────────────────── */}
      <section id="who" className={SECTION}>
        <h2 className={H2}>Who I am</h2>
        <div className="mt-5 flex flex-col gap-4 text-foreground/90">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div>
              <p>
                I&apos;m Islam Hafez, a developer from Cairo (Maadi), Egypt. My primary work is{" "}
                <strong>building ERP systems on Odoo</strong> — custom modules, Python backends, OWL
                frontends, and complete websites — at TaqaTechno since October 2024. Alongside that,
                I build production frontends with React, Next.js, and TypeScript.
              </p>
              <p className="mt-4">
                The assistant on this page answers questions about my work from a structured knowledge
                base of my CVs, projects, and commit history. This section contains the same
                information as readable text, in case you prefer to scroll rather than ask.
              </p>
            </div>
            {/* Headshot loaded eagerly — visible content, not decoration */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/islam-hafez-professional.png"
              alt="Islam Hafez, Odoo ERP and frontend developer, Cairo"
              width={400}
              height={400}
              loading="eager"
              decoding="async"
              className="h-32 w-32 shrink-0 rounded-2xl border border-border bg-card object-cover sm:h-36 sm:w-36"
            />
          </div>
        </div>
      </section>

      {/* ── Visual Gallery (Bento Grid for SEO) ────────────────────────────── */}
      <section id="gallery" className={SECTION}>
        <h2 className={H2}>Visual Gallery</h2>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[200px]">
          {getPhotos().map((photo, i) => {
            const spans = [
              "col-span-2 row-span-2", // Hero
              "col-span-1 row-span-1",
              "col-span-1 row-span-2", // Vertical
              "col-span-1 row-span-1",
              "col-span-2 row-span-1", // Wide
              "col-span-1 row-span-1",
              "col-span-1 row-span-1",
              "col-span-1 row-span-1",
              "col-span-1 row-span-1",
              "col-span-1 row-span-1",
            ];
            return (
              <figure
                key={photo.src}
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-border bg-card",
                  spans[i] || "col-span-1 row-span-1"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <figcaption className="sr-only">{photo.alt}</figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      {/* ── Odoo & ERP (lead) ─────────────────────────────────────────── */}
      <section id="odoo" className={cnSection()}>
        <h2 className={H2}>Odoo ERP development</h2>
        <p className="mt-5 max-w-2xl text-foreground/90">
          I build complete systems people run their business on — data model, permissions, PDF
          reports, field app — not just UI screens layered over existing Odoo features.
        </p>
        <div className="mt-8 flex flex-col gap-8">
          {erpProjects.map((p) => (
            <article key={p.name} className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground">{p.name}</h3>
              <p className="mt-2 text-xs text-muted-foreground">{p.meta}</p>
              {p.paragraphs.map((t, i) => (
                <p key={i} className="mt-3 text-[15px] leading-relaxed text-foreground/90">
                  {t}
                </p>
              ))}
            </article>
          ))}
        </div>

        <h3 className="mt-10 text-lg font-semibold text-foreground">
          Client work on live Odoo and Shopify sites
        </h3>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-[15px] text-foreground/90 marker:text-muted-foreground/60">
          {clientWork.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>

        <p className="mt-6 text-[15px] text-foreground/90">
          How I run a build: work packages merged one by one into an integration trunk, dev promoted
          to stage to main through pull requests, automated tests plus static checks, role-based
          access designed before features.
        </p>
      </section>

      {/* ── Translate Dashboard ────────────────────────────────────────── */}
      <section id="translate-dashboard" className={cnSection()}>
        <h2 className={H2}>Translate Dashboard — paid Odoo 19 module</h2>
        <div className="mt-5 flex flex-col gap-4 text-foreground/90">
          <p>
            Available on the{" "}
            <a className={LINK} href="https://apps.odoo.com/apps/modules/19.0/translate_dashboard" target="_blank" rel="noopener noreferrer">
              official Odoo Apps store
            </a>
            . Replaces manual .po editing: scan any module or theme, translate inline with keyboard
            shortcuts, then apply to the database, the website, and the .po file in one click.
            Written for Odoo 19 with OWL 2; 3,110 lines of code, no external dependencies.
          </p>
          <p>
            Tested with 6,219 translatable terms from Odoo&apos;s <code>base</code> module (scans in
            11 seconds). Server-side pagination handles 6,000+ terms without browser lag. Conflict
            detection between database and .po values with one-click resolution. A batched single SQL
            VALUES statement cut the apply time for 6,375 terms from 3.94 s to 0.58 s. Two user
            groups (Translator and Translation Manager) guard destructive operations. Priced at
            $70.72 under the OPL-1 license.
          </p>
        </div>
      </section>

      {/* ── Frontend ──────────────────────────────────────────────────── */}
      <section id="frontend" className={cnSection()}>
        <h2 className={H2}>Frontend: React, Next.js, TypeScript, Angular 17</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {frontendProjects.map((p) => (
            <article key={p.name} className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground">{p.meta}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-foreground/90">{p.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-[15px] text-foreground/90">
          Public projects are on{" "}
          <a className={LINK} href="https://github.com/islamhafez0" target="_blank" rel="noopener noreferrer">
            my GitHub
          </a>{" "}
          with their own demos. For the private fintech and ERP code, the commit counts and role
          records in my knowledge base are verified against the GitHub API.
        </p>
      </section>

      {/* ── How this chatbot works ─────────────────────────────────────── */}
      <section id="how-it-works" className={cnSection()}>
        <h2 className={H2}>How this chatbot works</h2>
        <div className="mt-5 flex flex-col gap-4 text-foreground/90">
          <p>
            A retrieval-augmented generation assistant: YAML files describing roles, projects, and
            skills are validated, chunked, embedded with Google&apos;s gemini-embedding-001 (3072
            dimensions), and stored in PostgreSQL with pgvector.
          </p>
          <p>
            Follow-up references like &ldquo;and his skills?&rdquo; or &ldquo;the bee one&rdquo; get
            merged into the full question with deterministic code — no extra LLM call. Retrieval is
            an exact cosine scan — no ANN index, since pgvector caps indexes at 2000 dimensions and
            these embeddings are 3072. gemma4:31b on Ollama Cloud answers in first person, streamed
            in under two seconds, with project cards and diagrams where the answer calls for them.
          </p>
          <p>
            Honesty constraints are explicit: no invented facts, links, or numbers; employers come
            only from role records; testimonials are kept separate from employment records; off-topic
            and salary questions are declined. Measured against a 49-scenario eval suite: retrieval
            Recall@8 of 0.993 and 48/48 graded answers on the current model.
          </p>
          <p>
            The full stack is open source:{" "}
            <a className={LINK} href="https://github.com/islamhafez0/rag-chatbot" target="_blank" rel="noopener noreferrer">
              github.com/islamhafez0/rag-chatbot
            </a>
            .
          </p>
        </div>
        <figure className="mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/rag-pipeline-architecture.svg"
            alt="RAG pipeline diagram: YAML knowledge base validated and embedded with Gemini, stored in PostgreSQL with pgvector, retrieved and answered by gemma4:31b on Ollama Cloud"
            width={960}
            height={620}
            loading="lazy"
            decoding="async"
            className="w-full rounded-xl border border-border bg-card"
          />
          <figcaption className="mt-2 text-xs text-muted-foreground">
            Ingestion lane (top) and request lane (bottom). Drawn by me, not a stock diagram.
          </figcaption>
        </figure>
      </section>

      {/* ── Experience ─────────────────────────────────────────────────── */}
      <section id="experience" className={cnSection()}>
        <h2 className={H2}>Work history</h2>
        <ol className="mt-8 flex flex-col gap-8 border-l border-border pl-5">
          {experience.map((e) => (
            <li key={`${e.company}-${e.period}`} className="relative">
              <span
                aria-hidden
                className="absolute -left-[23px] top-2 h-2.5 w-2.5 rounded-full border border-border bg-card"
              />
              <h3 className="text-base font-semibold text-foreground">
                {e.role} · <span className="text-muted-foreground">{e.company}</span>
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{e.period}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">{e.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Skills ──────────────────────────────────────────────────────── */}
      <section id="skills" className={cnSection()}>
        <h2 className={H2}>Technical skills</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {skills.map((group) => (
            <div key={group.group}>
              <h3 className="text-sm font-semibold text-foreground">{group.group}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.items.map((s) => (
                  <span key={s} className={CHIPS}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Writing ─────────────────────────────────────────────────────── */}
      <section id="writing" className={cnSection()}>
        <h2 className={H2}>Writing</h2>
        <ul className="mt-6 flex flex-col gap-3 text-[15px]">
          {articles.map((a) => (
            <li key={a.url}>
              <a className={LINK} href={a.url} target="_blank" rel="noopener noreferrer">
                {a.title}
              </a>
              <span className="text-muted-foreground"> · DEV Community · {a.date}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Certifications ──────────────────────────────────────────────── */}
      <section id="certifications" className={cnSection()}>
        <h2 className={H2}>Certifications</h2>
        <ul className="mt-6 flex flex-col gap-3 text-[15px]">
          {certifications.map((c) => (
            <li key={c.url}>
              <a className={LINK} href={c.url} target="_blank" rel="noopener noreferrer">
                {c.name}
              </a>
              <span className="text-muted-foreground"> · {c.issuer} · {c.date}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────── */}
      <section id="testimonials" className={cnSection()}>
        <h2 className={H2}>What clients and colleagues have said</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Shared in writing by people I&apos;ve worked with; kept here exactly as given.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-1">
          {testimonials.map((t) => (
            <figure key={t.name} className="rounded-xl border border-border bg-card p-5">
              <blockquote className="text-[15px] italic leading-relaxed text-foreground/90">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-3 text-xs text-muted-foreground">
                {t.name} · {t.context}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" className={cnSection()}>
        <h2 className={H2}>Frequently asked questions</h2>
        <dl className="mt-8 flex flex-col gap-6">
          {FAQ_ENTRIES.map((f) => (
            <div key={f.question}>
              <dt className="text-base font-semibold text-foreground">{f.question}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-foreground/90">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────── */}
      <section id="contact" className={cnSection()}>
        <h2 className={H2}>Get in touch</h2>
        <div className="mt-5 flex flex-col gap-4 text-[15px] text-foreground/90">
          <p>
            Available for Odoo ERP builds, custom Odoo modules, frontend and full-stack roles, and
            freelance projects. Write to{" "}
            <a className={LINK} href={`mailto:${EMAIL}`}>{EMAIL}</a> or WhatsApp{" "}
            <a className={LINK} href={`https://wa.me/${PHONE.replace(/\s/g, "")}`}>{PHONE}</a>.
          </p>
          <div className="flex flex-wrap gap-2">
            {SOCIALS.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${CHIPS} hover:border-foreground/30 hover:text-foreground`}
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 py-8 pb-24">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Everything on this page comes from my structured knowledge base (career_brain/), last
            cross-checked against public sources on 31 October 2026. The chatbot, knowledge base, and
            eval suite are open source at{" "}
            <a className={LINK} href="https://github.com/islamhafez0/rag-chatbot" target="_blank" rel="noopener noreferrer">
              github.com/islamhafez0/rag-chatbot
            </a>
            . © {new Date().getFullYear()} Islam Hafez.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* Section wrapper. */
function cnSection() {
  return SECTION;
}
