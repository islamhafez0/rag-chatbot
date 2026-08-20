import OpenAI from "openai";
import { OpenAIStream } from "ai";
import { envNumber, envString, validateEnv } from "./env";

validateEnv();

const MAX_TOKENS = envNumber("LLM_MAX_TOKENS");
const MAX_HISTORY_TURNS = envNumber("LLM_MAX_HISTORY_TURNS");
const TEMPERATURE = envNumber("LLM_TEMPERATURE");
const IS_OPENCODE_ZEN = /opencode/i.test(envString("LLM_BASE_URL"));

function thinkingParam(): object {
  return IS_OPENCODE_ZEN ? { thinking: { type: "disabled" } } : {};
}

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: envString("LLM_API_KEY"),
    baseURL: envString("LLM_BASE_URL"),
  });
}

function getModel(): string {
  return envString("LLM_MODEL");
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function buildSystemPrompt(docContext: string): string {
  return `You are the "Career Brain" for Islam Hafez, an Advanced Career Assistant.
Your goal is to provide highly accurate, detailed, and professional information about Islam's career, projects, and skills based ONLY on the provided CONTEXT.

CONTEXT SOURCE:
The context comes from structured knowledge files (career brain). Treat them as ground truth.

RESPONSE GUIDELINES:
- BE SPECIFIC: Use technical names, project details, and exact achievements from the context.
- TONE: Professional, confident, and direct.
- LENGTH: Concise but thorough. Provide enough detail to fully answer the query without fluff. If the answer requires detail (e.g., project features), provide it.
- NO META-TALK: Never mention you are an AI or that you are searching context. Just answer.
- NO HEDGING: Avoid phrases like "Based on the context..." or "It seems that...". State facts.
- CONSISTENCY: Never contradict a fact you already stated earlier in this conversation. If the CONTEXT is incomplete, keep your earlier established facts and answer from them.
- COMPLETENESS: Before saying information is missing, check whether the CONTEXT contains it. Prefer answering from what is present over declaring it missing.

DATA UTILIZATION:
- When asked about projects, list key features and tech stacks mentioned.
- When asked about experience, describe the impact and specific responsibilities.
- If asked for a short answer, provide a 1-2 sentence punchy response.

IMAGES:
- ONLY include images (as markdown ![alt](src) using the exact src from the CONTEXT) when the user explicitly asks for a photo, picture, or image of Islam.
- Otherwise, never include images in your answer — even if the CONTEXT contains image entries.
- Never invent URLs. Only use src values present in the CONTEXT.

MISSING INFORMATION:
If the context does not contain the answer, respond exactly with:
"I don't have that specific information in my knowledge base yet."

CONTEXT:
${docContext}`;
}

function toChatMessages(systemPrompt: string, turns: ChatTurn[]) {
  const history = turns.slice(-MAX_HISTORY_TURNS);
  return [
    { role: "system", content: systemPrompt },
    ...history,
  ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}

export async function generateAnswer(options: {
  systemPrompt: string;
  turns: ChatTurn[];
}): Promise<string> {
  const { systemPrompt, turns } = options;

  const response = await getClient().chat.completions.create({
    model: getModel(),
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    messages: toChatMessages(systemPrompt, turns),
    ...thinkingParam(),
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

export async function createAnswerStream(options: {
  systemPrompt: string;
  turns: ChatTurn[];
  onFirstToken?: (ttftMs: number) => void;
  onFinal?: (completion: string) => void;
}): Promise<ReadableStream> {
  const { systemPrompt, turns, onFirstToken, onFinal } = options;

  const start = performance.now();
  const response = await getClient().chat.completions.create({
    model: getModel(),
    stream: true,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    messages: toChatMessages(systemPrompt, turns),
    ...thinkingParam(),
  });
  let reported = false;
  return OpenAIStream(response as unknown as Parameters<typeof OpenAIStream>[0], {
    onToken() {
      if (!reported && onFirstToken) {
        reported = true;
        onFirstToken(performance.now() - start);
      }
    },
    onFinal,
  });
}
