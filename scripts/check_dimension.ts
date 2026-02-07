import "dotenv/config";
import { DataAPIClient } from "@datastax/astra-db-ts";

async function main() {
    const { ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_COLLECTION } = process.env;

    const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN as string);
    const db = client.db(ASTRA_DB_API_ENDPOINT as string);
    const collections = await db.listCollections();
    const current = collections.find(c => c.name === (ASTRA_DB_COLLECTION || "career_vectors"));

    console.log("Collection Info:", JSON.stringify(current, null, 2));
}

main().catch(console.error);
