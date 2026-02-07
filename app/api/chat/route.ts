import { OpenAIStream, StreamingTextResponse, StreamData } from "ai";
import { getContext } from "@/lib/astra";
import OpenAI from "openai";

const { GROQ_API_KEY } = process.env;

const groq = new OpenAI({
  apiKey: GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1",
});

export async function POST(req: Request) {
  const data = new StreamData();
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages?.length - 1]?.content;

    const { text: docContext, sources } = await getContext(latestMessage);

    if (sources.length > 0) {
      data.append({ sources });
    }

    const systemPrompt = `
      You are the "Career Brain" for Islam Hafez, an Advanced Career Assistant.
      Your goal is to provide highly accurate, detailed, and professional information about Islam's career, projects, and skills based ONLY on the provided CONTEXT.

      CONTEXT SOURCE:
      The context provided comes from structured YAML files (labeled as Career Brain). Treat these as ground truth.

      RESPONSE GUIDELINES:
      - BE SPECIFIC: Use technical names, project details, and exact achievements from the context.
      - TONE: Professional, confident, and direct.
      - LENGTH: Be concise but thorough. Provide enough detail to fully answer the query without fluff. If the answer requires detail (e.g., project features), provide it.
      - NO META-TALK: Never mention you are an AI or that you are searching context. Just answer.
      - NO HEDGING: Avoid phrases like "Based on the context..." or "It seems that...". State facts.

      DATA UTILIZATION:
      - When asked about projects, list key features and tech stacks mentioned.
      - When asked about experience, describe the impact and specific responsibilities.
      - If asked for a short answer, provide a 1-2 sentence punchy response followed by a natural follow-up question if applicable.

      MISSING INFORMATION:
      If the context does not contain the answer, respond exactly with:
      "I don’t have that specific information in my knowledge base yet."

      CONTEXT:
      ${docContext}
    `;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
    });

    const stream = OpenAIStream(response as any, {
      onFinal(completion) {
        data.close();
      },
    });

    return new StreamingTextResponse(stream, {}, data);
  } catch (error: any) {
    console.error("Error in chat route:", error);

    try {
      data.close();
    } catch (e) { }

    const status = error.status || (error.message?.includes("429") ? 429 : 500);
    const errorMessage = status === 429
      ? "AI Rate limit reached. Please wait a minute before trying again."
      : (error.message || "Internal Server Error");

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
