/** Static personal-brand data for the landing hero (mirrors career_brain/facts/profile.yml). */
export const PROFILE = {
  name: "Islam Hafez",
  firstName: "Islam",
  lastName: "Hafez",
  role: "Frontend Developer (React, Next.js) & Odoo Specialist",
  pitch:
    "I build fast, pixel-perfect web apps with React, Next.js and TypeScript, and custom Odoo modules, themes and websites with Python and OWL. This assistant answers from my real CV, projects and code. Ask it anything.",
  location: "Cairo, Egypt",
  avatar: "/images/professionalme.png",
  cvs: [
    { label: "Frontend CV", href: "/files/islam-hafez-frontend.pdf" },
    { label: "Odoo CV", href: "/files/islam-hafez-odoo.pdf" },
  ],
  socials: [
    { label: "GitHub", href: "https://github.com/islamhafez0", kind: "github" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/islamhafez0", kind: "linkedin" },
    { label: "Portfolio", href: "https://islamhafez.vercel.app", kind: "web" },
  ],
} as const;

export const SUGGESTIONS = [
  { label: "Walk me through your experience", icon: "briefcase" },
  { label: "Show your best projects", icon: "sparkles" },
  { label: "How is this chatbot built?", icon: "cpu" },
  { label: "Frontend or Odoo — what's your focus?", icon: "split" },
  { label: "What is your tech stack?", icon: "cpu" },
  { label: "Tell me about your Odoo modules", icon: "briefcase" },
  { label: "What are your key achievements?", icon: "sparkles" },
  { label: "Download your CV", icon: "file" },
] as const;
