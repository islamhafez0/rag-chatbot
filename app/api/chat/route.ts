import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenerativeAIStream, StreamingTextResponse, StreamData } from "ai";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const {
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_COLLECTION,
  GOOGLE_API_KEY,
} = process.env;

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY || "");

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN as string);
const db = client.db(ASTRA_DB_API_ENDPOINT as string, {
  keyspace: process.env.ASTRA_DB_NAMESPACE,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages?.length - 1]?.content;

    let docContext = "";

    // Create a StreamData object to send metadata (citations)
    const data = new StreamData();

    if (latestMessage) {
      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: GOOGLE_API_KEY,
        modelName: "text-embedding-004",
      });

      const vector = await embeddings.embedQuery(latestMessage);

      const collection = await db.collection(
        ASTRA_DB_COLLECTION || "career_vectors",
      );
      const cursor = await collection.find(
        {},
        {
          sort: { $vector: vector },
          limit: 5,
          includeSimilarity: true,
        },
      );

      const documents = await cursor.toArray();
      docContext = documents.map((doc: any) => doc.text).join("\n\n");

      // Extract unique sources and send as metadata
      const sources = Array.from(new Set(documents.map((doc: any) => doc.source))).filter(Boolean);
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

    const geminiModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const history = [
      {
        role: "user",
        parts: [{ text: `INSTRUCTION: ${systemPrompt}` }],
      },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I will act as your Personal Intelligence and use the provided context to answer questions.",
          },
        ],
      },
      ...messages.slice(0, -1).map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
    ];

    const result = await geminiModel.generateContentStream({
      contents: [
        ...history,
        { role: "user", parts: [{ text: latestMessage }] },
      ],
    });

    const stream = GoogleGenerativeAIStream(result, {
      onFinal() {
        data.close();
      }
    });

    return new StreamingTextResponse(stream, {}, data);
  } catch (error: any) {
    console.error("Error in chat route:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
