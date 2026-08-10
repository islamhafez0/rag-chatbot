import "dotenv/config";
import { DataAPIClient } from "@datastax/astra-db-ts";

async function main() {
    const { ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_COLLECTION } = process.env;

    const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN as string);
    const db = client.db(ASTRA_DB_API_ENDPOINT as string);
    const collectionName = ASTRA_DB_COLLECTION || "career_vectors";

    console.log(`Deleting collection ${collectionName}...`);
    try {
        await db.dropCollection(collectionName);
        console.log("Deleted.");
    } catch (e) {
        console.log("Collection did not exist or could not be deleted.");
    }

    console.log(`Creating collection ${collectionName} with 3072 dimensions...`);
    await db.createCollection(collectionName, {
        vector: {
            dimension: 3072,
            metric: "cosine",
        },
        lexical: {
            enabled: true
        },
        rerank: {
            enabled: true,
            service: {
                provider: "nvidia",
                modelName: "nvidia/llama-3.2-nv-rerankqa-1b-v2"
            }
        }
    });
    console.log("Created successfully.");
}

main().catch(console.error);
