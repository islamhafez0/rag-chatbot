export interface Scenario {  id: string;
  label: string;
  messages: { role: string; content: string }[];
  /**
   * File-level relevant set (source paths as stored in the DB) used for
   * retrieval metrics. Empty = the KB has no relevant document (decline
   * cases); retrieval returning docs for these is expected — declining is
   * the generator's job and is checked in the answer phase.
   */
  expectedSources: string[];
  keyFacts?: string[];
  emptyKnowledge?: boolean;
  note?: string;
}

/**
 * Recall@K over file-level sources. Empty expected set (absent-KB cases)
 * scores 1 — those scenarios are gated by the answer-phase decline check.
 */
export function recallAtK(expected: string[], retrieved: string[], k: number): number {
  if (expected.length === 0) return 1;
  const topK = new Set(retrieved.slice(0, k));
  const hits = expected.filter((s) => topK.has(s)).length;
  return hits / expected.length;
}

const PROJECTS_ALL = [
  "projects/rag-chatbot.yml",
  "projects/youtube-clone.yml",
  "projects/gemini-ai.yml",
  "projects/project-template.yml",
];
const ROLES_ALL = ["roles/current.yml", "roles/previous.yml"];

export const SCENARIOS: Scenario[] = [
  { id: "projects-list", label: "projects", expectedSources: PROJECTS_ALL, keyFacts: ["RAG Career Chatbot", "YouTube clone"],
    messages: [{ role: "user", content: "What projects has Islam built?" }] },
  { id: "projects-rag", label: "projects", expectedSources: ["projects/rag-chatbot.yml"], keyFacts: ["RAG Career Chatbot"],
    messages: [{ role: "user", content: "Tell me about the RAG Career Chatbot" }] },
  { id: "projects-youtube", label: "projects", expectedSources: ["projects/youtube-clone.yml"], keyFacts: ["YouTube"],
    messages: [{ role: "user", content: "What is the youtube clone project about?" }] },
  { id: "projects-gemini", label: "projects", expectedSources: ["projects/gemini-ai.yml"], keyFacts: ["Gemini"],
    messages: [{ role: "user", content: "Tell me about the gemini ai project" }] },

  { id: "roles-companies", label: "roles", expectedSources: ROLES_ALL, keyFacts: ["TaqaTechno", "Code Alpha"],
    messages: [{ role: "user", content: "Which companies has Islam worked at?" }] },
  { id: "roles-timeline", label: "roles", expectedSources: ROLES_ALL, keyFacts: ["TaqaTechno", "Code Alpha"],
    messages: [{ role: "user", content: "What is his full experience timeline?" }] },
  { id: "roles-intern", label: "roles", expectedSources: ["roles/previous.yml"], keyFacts: ["Code Alpha", "Intern"],
    messages: [{ role: "user", content: "did he have any internships?" }] },
  { id: "roles-current", label: "roles", expectedSources: ["roles/current.yml"], keyFacts: ["TaqaTechno", "Odoo"],
    messages: [{ role: "user", content: "what is his current role?" }] },
  { id: "roles-typo", label: "roles", expectedSources: ["roles/previous.yml"], keyFacts: ["second role"], note: "typo; role ordering in file is TaqaTechno, Self-Employed, Code Alpha",
    messages: [{ role: "user", content: "what os his secound role?" }] },

  { id: "facts-who", label: "facts", expectedSources: ["facts/profile.yml"], keyFacts: ["Islam Hafez", "Frontend"],
    messages: [{ role: "user", content: "Who is Islam Hafez?" }] },
  { id: "facts-education", label: "facts", expectedSources: ["facts/profile.yml"], keyFacts: ["Damanhour"],
    messages: [{ role: "user", content: "What is his education background?" }] },
  { id: "facts-hobbies", label: "unsupported", expectedSources: [], emptyKnowledge: true, note: "nothing in the KB covers hobbies",
    messages: [{ role: "user", content: "What does Islam do for fun outside work?" }] },

  { id: "skills-tech", label: "skills->facts", expectedSources: ["facts/skills.yml"], keyFacts: ["React", "Next.js", "TypeScript"], note: "skills.yml lives under facts/",
    messages: [{ role: "user", content: "What technologies does he know?" }] },
  { id: "skills-list", label: "skills->facts", expectedSources: ["facts/skills.yml"], keyFacts: ["React"],
    messages: [{ role: "user", content: "What skills does Islam have?" }] },

  { id: "interview-strengths", label: "interviews", expectedSources: ["interviews/common-answers.yml"], keyFacts: ["adapt"],
    messages: [{ role: "user", content: "How should I answer what are your strengths in an interview?" }] },
  { id: "interview-tell", label: "interviews", expectedSources: ["interviews/common-answers.yml"], keyFacts: ["Islam Hafez", "frontend"],
    messages: [{ role: "user", content: "how should he answer tell me about yourself?" }] },

  { id: "feedback-people", label: "feedback", expectedSources: [], emptyKnowledge: true, note: "testimonials.yml is empty",
    messages: [{ role: "user", content: "What do people say about working with him?" }] },

  { id: "rules-personality", label: "rules", expectedSources: ["rules/personality.yml"],
    messages: [{ role: "user", content: "How does he prefer to communicate?" }] },

  { id: "offtopic-joke", label: "off-topic", expectedSources: [], emptyKnowledge: true,
    messages: [{ role: "user", content: "tell me a joke about dinosaurs" }] },
  { id: "offtopic-capital", label: "off-topic", expectedSources: [], emptyKnowledge: true,
    messages: [{ role: "user", content: "what is the capital of France?" }] },

  { id: "multiturn-and", label: "degenerate and", expectedSources: ["projects/rag-chatbot.yml"], keyFacts: ["pgvector"],
    messages: [
      { role: "user", content: "Tell me about the RAG Career Chatbot" },
      { role: "assistant", content: "It is a RAG chatbot for his career built with Next.js and LangChain." },
      { role: "user", content: "and" },
    ] },
  { id: "multiturn-skillspronoun", label: "pronoun skills", expectedSources: [...ROLES_ALL, "facts/skills.yml"], keyFacts: ["React"],
    messages: [
      { role: "user", content: "What is his experience timeline?" },
      { role: "assistant", content: "He interned at Code Alpha and later worked at TaqaTechno." },
      { role: "user", content: "and his skills?" },
    ] },
  { id: "multiturn-youtube-one", label: "the X one", expectedSources: ["projects/youtube-clone.yml"], keyFacts: ["YouTube"],
    messages: [
      { role: "user", content: "What projects has Islam built?" },
      { role: "assistant", content: "He built a RAG chatbot, a YouTube clone, and more." },
      { role: "user", content: "what about the youtube one?" },
    ] },
  { id: "multiturn-consistency", label: "consistency check", expectedSources: ROLES_ALL, keyFacts: ["TaqaTechno", "Code Alpha"],
    messages: [
      { role: "user", content: "what is his current role?" },
      { role: "assistant", content: "He currently works at TaqaTechno." },
      { role: "user", content: "and what did he do before?" },
    ] },
];
