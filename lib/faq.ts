/** Real Q&A rendered as visible HTML and mirrored into FAQPage JSON-LD. */
export type Faq = { question: string; answer: string };

export const FAQ_ENTRIES: Faq[] = [
  {
    question: "Who is Islam Hafez?",
    answer:
      "A developer from Cairo (Maadi), Egypt who builds complete ERP systems on Odoo 17/19 — apiary management, disaster response, humanitarian storefronts, SaaS tenant provisioning — plus production frontends with React, Next.js and TypeScript. He has worked at TaqaTechno since October 2024.",
  },
  {
    question: "I need an Odoo ERP or a custom Odoo module. Is that something he does?",
    answer:
      "Yes. He builds custom Odoo modules and APIs in Python, OWL and QWeb frontends, full custom websites on Odoo, role-based access rules, dashboards, automated test suites, and publishes paid modules on the official Odoo Apps store. Contact details are below.",
  },
  {
    question: "How is this chatbot built?",
    answer:
      "It is a retrieval-augmented generation (RAG) assistant: YAML files describing roles, projects and skills are validated, chunked and embedded with Google gemini-embedding-001 (3072 dimensions) into PostgreSQL with pgvector. Questions are merged with follow-ups deterministically, retrieved by exact cosine scan, and answered in first person by gemma4:31b on Ollama Cloud. The full stack is open in the rag-chatbot GitHub repository.",
  },
  {
    question: "Where does the assistant get its answers from?",
    answer:
      "From a structured knowledge base built out of his CVs, portfolio, the Odoo Apps store listing, GitHub API data and commit history. Every skill and project points at evidence files. The assistant is instructed not to invent facts, links or numbers, and it declines off-topic questions and salary questions.",
  },
  {
    question: "Can I download Islam's CV here?",
    answer:
      "Yes. There are two ATS-friendly PDFs generated from the same knowledge base: an Odoo CV (/files/islam-hafez-odoo.pdf) and a Frontend CV (/files/islam-hafez-frontend.pdf).",
  },
  {
    question: "What is Translate Dashboard and where can I buy it?",
    answer:
      "A paid Odoo 19 module Islam built and sells on the official Odoo Apps store. It scans any module or theme, translates inline with keyboard shortcuts, then applies to the database, website and .po file in one click. Price $70.72, OPL-1 license, tested with 6,219 terms from Odoo's base module.",
  },
  {
    question: "Is Islam available for work?",
    answer:
      "Yes, for Odoo ERP builds and custom modules, frontend and full-stack roles, and freelance projects. Contact islamhafez806@gmail.com or WhatsApp +20 10 9742 3297. Salary and compensation details are handled directly, not through the chatbot.",
  },
  {
    question: "Where is Islam based?",
    answer:
      "Cairo (Maadi), Egypt. He works remotely with international clients and teams.",
  },
];

export function faqJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ENTRIES.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}
