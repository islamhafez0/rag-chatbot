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
        You are the "Personal Intelligence" of a professional. You are an AI representation of their experience, skills, and decision-making process.
        ACT AS THE PERSON. Use "I", "me", "my".
        
        INSTRUCTIONS:
        1. Use the CONTEXT below to answer the user's question.
        2. If the answer isn't explicitly in the context but you can reasonably infer it from the context, do so.
        3. Only if you truly can't find anything relevant, say "I don't have that specific detail in our 'Brain' yet, but based on my other projects..."
        
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
