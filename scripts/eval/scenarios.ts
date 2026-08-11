export interface Scenario {
  id: string;
  label: string;
  messages: { role: string; content: string }[];
  expectedCategory: string | null;
  keyFacts?: string[];
  emptyKnowledge?: boolean;
  note?: string;
}

export const SCENARIOS: Scenario[] = [
  { id: "projects-list", label: "projects", expectedCategory: "projects", keyFacts: ["RAG Career Chatbot", "YouTube clone"],
    messages: [{ role: "user", content: "What projects has Islam built?" }] },
  { id: "projects-rag", label: "projects", expectedCategory: "projects", keyFacts: ["RAG Career Chatbot"],
    messages: [{ role: "user", content: "Tell me about the RAG Career Chatbot" }] },
  { id: "projects-youtube", label: "projects", expectedCategory: "projects", keyFacts: ["YouTube"],
    messages: [{ role: "user", content: "What is the youtube clone project about?" }] },
  { id: "projects-gemini", label: "projects", expectedCategory: "projects", keyFacts: ["Gemini"],
    messages: [{ role: "user", content: "Tell me about the gemini ai project" }] },

  { id: "roles-companies", label: "roles", expectedCategory: "roles", keyFacts: ["TaqaTechno", "Code Alpha"],
    messages: [{ role: "user", content: "Which companies has Islam worked at?" }] },
  { id: "roles-timeline", label: "roles", expectedCategory: "roles", keyFacts: ["TaqaTechno", "Code Alpha"],
    messages: [{ role: "user", content: "What is his full experience timeline?" }] },
  { id: "roles-intern", label: "roles", expectedCategory: "roles", keyFacts: ["Code Alpha", "Intern"],
    messages: [{ role: "user", content: "did he have any internships?" }] },
  { id: "roles-current", label: "roles", expectedCategory: "roles", keyFacts: ["TaqaTechno", "Odoo"],
    messages: [{ role: "user", content: "what is his current role?" }] },
  { id: "roles-typo", label: "roles", expectedCategory: "roles", keyFacts: ["second role"], note: "typo; role ordering in file is TaqaTechno, Self-Employed, Code Alpha",
    messages: [{ role: "user", content: "what os his secound role?" }] },

  { id: "facts-who", label: "facts", expectedCategory: "facts", keyFacts: ["Islam Hafez", "Frontend"],
    messages: [{ role: "user", content: "Who is Islam Hafez?" }] },
  { id: "facts-education", label: "facts", expectedCategory: "facts", keyFacts: ["Damanhour"],
    messages: [{ role: "user", content: "What is his education background?" }] },

  { id: "skills-tech", label: "skills->facts", expectedCategory: "facts", keyFacts: ["React", "Next.js", "TypeScript"], note: "skills.yml lives under facts/",
    messages: [{ role: "user", content: "What technologies does he know?" }] },
  { id: "skills-list", label: "skills->facts", expectedCategory: "facts", keyFacts: ["React"],
    messages: [{ role: "user", content: "What skills does Islam have?" }] },

  { id: "interview-strengths", label: "interviews", expectedCategory: "interviews", keyFacts: ["adapt"],
    messages: [{ role: "user", content: "How should I answer what are your strengths in an interview?" }] },
  { id: "interview-tell", label: "interviews", expectedCategory: "interviews", keyFacts: ["Islam Hafez", "frontend"],
    messages: [{ role: "user", content: "how should he answer tell me about yourself?" }] },

  { id: "feedback-people", label: "feedback", expectedCategory: "feedback", emptyKnowledge: true, note: "testimonials.yml is empty",
    messages: [{ role: "user", content: "What do people say about working with him?" }] },

  { id: "rules-personality", label: "rules", expectedCategory: "rules",
    messages: [{ role: "user", content: "How does he prefer to communicate?" }] },

  { id: "offtopic-joke", label: "off-topic", expectedCategory: null, emptyKnowledge: true,
    messages: [{ role: "user", content: "tell me a joke about dinosaurs" }] },
  { id: "offtopic-capital", label: "off-topic", expectedCategory: null, emptyKnowledge: true,
    messages: [{ role: "user", content: "what is the capital of France?" }] },

  { id: "multiturn-and", label: "degenerate and", expectedCategory: "projects", keyFacts: ["Astra DB"],
    messages: [
      { role: "user", content: "Tell me about the RAG Career Chatbot" },
      { role: "assistant", content: "It is a RAG chatbot for his career built with Next.js and LangChain." },
      { role: "user", content: "and" },
    ] },
  { id: "multiturn-skillspronoun", label: "pronoun skills", expectedCategory: "facts", keyFacts: ["React"],
    messages: [
      { role: "user", content: "What is his experience timeline?" },
      { role: "assistant", content: "He interned at Code Alpha and later worked at TaqaTechno." },
      { role: "user", content: "and his skills?" },
    ] },
  { id: "multiturn-youtube-one", label: "the X one", expectedCategory: "projects", keyFacts: ["YouTube"],
    messages: [
      { role: "user", content: "What projects has Islam built?" },
      { role: "assistant", content: "He built a RAG chatbot, a YouTube clone, and more." },
      { role: "user", content: "what about the youtube one?" },
    ] },
  { id: "multiturn-consistency", label: "consistency check", expectedCategory: "roles", keyFacts: ["TaqaTechno", "Code Alpha"],
    messages: [
      { role: "user", content: "what is his current role?" },
      { role: "assistant", content: "He currently works at TaqaTechno." },
      { role: "user", content: "and what did he do before?" },
    ] },
];
