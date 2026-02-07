import "dotenv/config";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { DataAPIClient } from "@datastax/astra-db-ts";

const {
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    ASTRA_DB_COLLECTION,
    GOOGLE_API_KEY,
} = process.env;

async function main() {
    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: GOOGLE_API_KEY,
        modelName: "gemini-embedding-001",
    });

    const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN as string);
    const db = client.db(ASTRA_DB_API_ENDPOINT as string);
    const collection = db.collection(ASTRA_DB_COLLECTION || "career_vectors");

    console.log("Embedding test text...");
    const vector = await embeddings.embedQuery("Test document content");
    console.log("Vector length:", vector.length);

    console.log("Inserting into Astra DB...");
    const result = await collection.insertOne({
        text: "Test document content",
        source: "test.txt",
        $vector: vector
    });

    console.log("Insert result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
