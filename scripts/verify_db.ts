import "dotenv/config";
import { DataAPIClient } from "@datastax/astra-db-ts";

async function main() {
    const { ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_COLLECTION } = process.env;

    const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN as string);
    const db = client.db(ASTRA_DB_API_ENDPOINT as string);
    const collection = db.collection(ASTRA_DB_COLLECTION || "career_vectors");

    const count = await collection.estimatedDocumentCount();
    console.log(`Total documents in collection "${ASTRA_DB_COLLECTION || "career_vectors"}": ${count}`);
}

main().catch(console.error);
