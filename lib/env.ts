function isSet(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

const REQUIRED_STRINGS = [
  "DATABASE_URL",
  "ASTRA_DB_COLLECTION",
  "GOOGLE_API_KEY",
  "EMBEDDING_MODEL",
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
];

const REQUIRED_NUMBERS = [
  "RETRIEVAL_LIMIT",
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

/** Optional number with a validated default (never throws when unset). */
export function envOptionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    throw new Error(`Environment variable "${name}" must be a number, got "${raw}".`);
  }
  return num;
}

/** Optional boolean with a validated default. Accepts true/false/1/0. */
export function envOptionalBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new Error(
    `Environment variable "${name}" must be a boolean (true/false), got "${raw}".`
  );
}

/**
 * Guard for SQL identifiers interpolated from configuration (table names).
 * Throws a clear startup error instead of emitting invalid or hostile SQL.
 */
export function assertValidIdentifier(what: string, value: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(
      `Invalid ${what} "${value}": use only letters, digits and underscores, starting with a letter or underscore.`
    );
  }
}
