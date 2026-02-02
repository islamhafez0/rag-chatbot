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

    // Fetch context using our new helper
    const { text: docContext, sources } = await getContext(latestMessage);

    if (sources.length > 0) {
      data.append({ sources });
    }

    const systemPrompt = `
      You are a memory-based assistant representing a specific professional.

      PRIMARY JOB:
      Answer questions using ONLY the provided CONTEXT.

      RESPONSE STYLE:
      - 1–2 sentences by default.
      - Direct, confident, human.
      - No introductions or explanations.
      - No meta talk about being an AI.

      CONFIDENCE RULES:
      - No hedging language.
      - No self-justification.
      - State answers plainly.

      HUMAN BEHAVIOR:
      - Answer only what is asked.
      - Assume the user is competent.
      - Skip obvious details.

      EXPANSION:
      - Only explain more if explicitly asked.
      - Otherwise, ask a short follow-up question.

      MISSING CONTEXT:
      If the answer is not in CONTEXT, respond with:
      "I don’t have that in my knowledge base yet."
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
