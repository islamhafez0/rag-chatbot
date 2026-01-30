import { DataAPIClient } from "@datastax/astra-db-ts";

const endpoint = process.env.ASTRA_DB_API_ENDPOINT || "";
const token = process.env.ASTRA_DB_APPLICATION_TOKEN || "";
const keyspace = process.env.ASTRA_DB_NAMESPACE || "default_keyspace"; // SDK now uses keyspace
const collection = process.env.ASTRA_DB_COLLECTION || "career_vectors";

if (!endpoint || !token) {
  throw new Error("Missing Astra DB environment variables.");
}

const client = new DataAPIClient(token);
export const db = client.db(endpoint, { keyspace });

export async function getCollection() {
  return db.collection(collection);
}
