function isSet(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

const REQUIRED_STRINGS = [
  "ASTRA_DB_API_ENDPOINT",
  "ASTRA_DB_APPLICATION_TOKEN",
  "ASTRA_DB_NAMESPACE",
  "ASTRA_DB_COLLECTION",
  "GOOGLE_API_KEY",
  "EMBEDDING_MODEL",
  "ROUTER",
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
];

const REQUIRED_NUMBERS = [
  "RETRIEVAL_LIMIT",
  "ROUTE_THRESHOLD",
  "ROUTE_MARGIN",
  "LLM_MAX_TOKENS",
  "LLM_MAX_HISTORY_TURNS",
  "LLM_TEMPERATURE",
];

export function validateEnv(): void {
  const missing = REQUIRED_STRINGS.filter((name) => !isSet(process.env[name]));
  const badNumbers = REQUIRED_NUMBERS.filter(
    (name) => !isSet(process.env[name]) || !Number.isFinite(Number(process.env[name]))
  );
  const parts: string[] = [];
  if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
  if (badNumbers.length) parts.push(`missing or not a number: ${badNumbers.join(", ")}`);
  if (parts.length) {
    throw new Error(
      `Required environment variables are not configured (${parts.join("; ")}).\n` +
      `Fill them in your .env file — the application will not function without them.`
    );
  }
}

export function envString(name: string): string {
  const value = process.env[name];
  if (!isSet(value)) {
    throw new Error(`Environment variable "${name}" is not set.`);
  }
  return value as string;
}

export function envNumber(name: string): number {
  const value = envString(name);
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Environment variable "${name}" must be a number, got "${value}".`);
  }
  return num;
}

export function envRouter(): "vector" | "none" {
  const value = envString("ROUTER");
  if (value !== "vector" && value !== "none") {
    throw new Error(`Environment variable "ROUTER" must be "vector" or "none", got "${value}".`);
  }
  return value;
}
