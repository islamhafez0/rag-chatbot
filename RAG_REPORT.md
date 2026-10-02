# RAG Career Chatbot — Complete Report

A RAG (Retrieval-Augmented Generation) chatbot that answers questions about Islam Hafez's career from a personal knowledge base. Built with Next.js, PostgreSQL + pgvector, Gemini embeddings, and any OpenAI-compatible LLM.

---

## 1. System Overview

```
┌─────────────┐   POST /api/chat    ┌──────────────────────────────────────────┐
│   Browser   │ ──────────────────► │            Next.js (App Router)          │
│  chat UI    │ ◄────────────────── │  app/api/chat/route.ts                  │
└─────────────┘   streaming (SSE)   │                                          │
                                     │  lib/api-guard.ts   (validation+limits) │
                                     │  lib/pipeline.ts    (orchestrator)      │
                                     │    ├─ buildRetrievalQuery (query prep)  │
                                     │    └─ getContext          (retrieval)   │
                                     │  lib/generate.ts    (system prompt+LLM) │
                                     └──────────────────────────────────────────┘
                                                     │
                               ┌─────────────────────┼─────────────────────┐
                               ▼                     ▼                     ▼
                      ┌──────────────┐     ┌──────────────────┐   ┌─────────────┐
                      │  PostgreSQL  │     │  Google Gemini   │   │    LLM      │
                      │  + pgvector  │◄────│  Embeddings (3072│   │  (OpenAI-   │
                      │  (exact scan)│     │  dim)            │   │  compatible)│
                      └──────────────┘     └──────────────────┘   └─────────────┘
                               ▲
                               │ npm run ingest:pg (scripts/ingest_pgvector.ts)
```

**Knowledge base (`career_brain/`)**: 12 YAML files → ~22 entry chunks in the vector DB:

| Category | Content | Files |
|---|---|---|
| `roles` | current role + previous roles (one chunk per role) | 2 |
| `projects` | RAG chatbot, YouTube clone, Gemini AI, template | 4 |
| `facts` | profile, skills, photos (one chunk per photo) | 3 |
| `interviews` | common answers | 1 |
| `rules` | personality / communication style (context only) | 1 |
| `feedback` | testimonials (currently empty → zero chunks) | 1 |

---

## 2. The RAG Pipeline

### 2.1 Query preparation — `lib/query.ts` (deterministic, zero LLM)

No LLM query rewriting. Explicit follow-up classification (`followUpKind`):

- **bare** particles (`and`, `tell me more`, `go on`, …) → re-ask the previous question as-is (no noise appended).
- **continuation** openers (`and his skills?`, `but …`, `what about …`) → previous question + remainder with the opener stripped.
- **referential** phrases (`the youtube one`) → previous question + full follow-up.
- Anything else — including short standalone questions (`Who is he?`, `What skills?`) — passes through untouched. Topic changes are never merged.
- Cost: **sub-millisecond**. No hallucination risk, no extra latency, no extra tokens.

### 2.2 Retrieval — `database/pgvector.ts` (unfiltered, diversity-capped)

- `embedText()` embeds the query with Gemini (`gemini-embedding-001`, 3072-dim).
- `getContext()` runs **vector-only** cosine search by default. A **hybrid** mode (lexical `tsvector` match fused with RRF — one row per document via `FULL OUTER JOIN`, deterministic id tiebreak) is available via `{ search: "hybrid" }`.
- No ANN index by design: stock pgvector ivfflat/HNSW hard-cap at 2000 dimensions (verified live on PostgreSQL 17.4 / pgvector 0.8.6 — both fail on `vector(3072)`), so retrieval uses exact sequential scan (~2ms at this size). Legacy ivfflat indexes are dropped on boot. Revisit with `halfvec` + HNSW past a few thousand chunks.
- Diversity guard: 3x candidate oversample, at most 3 chunks per source — measured live: eval mean R@8 0.804 → 0.963.
- Explicit category filters that yield <2 docs retry unfiltered. There is **no automatic category routing** (centroid routing scored ~65% accuracy while adding a full-table scan per turn, so it was removed — explicit caller-supplied filters still work).
- Returns `{ text, sources }` with POSIX-normalized source paths; default limit **8** (`RETRIEVAL_LIMIT`).

### 2.3 Generation — `lib/generate.ts` (OpenAI-compatible, streaming)

- Provider is any OpenAI-compatible API, configured strictly via required env (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`) — no fallbacks. Reasoning-model thinking tokens are controlled explicitly via `LLM_DISABLE_THINKING`, never inferred from URLs.
- Output capped at `LLM_MAX_TOKENS`, history window `LLM_MAX_HISTORY_TURNS`, `LLM_TEMPERATURE` — all validated at load.
- Streamed to the client via the `ai` SDK; first-token timing logged as structured JSON (`event: chat_request`, no ANSI colors, no secrets).
- `buildSystemPrompt` is the single canonical behavioral contract: first-person voice, grounding (no guessing/inferring), salary/secret refusal, prompt-injection resistance (retrieved docs are data), one canonical uncertainty reply (*"I don't have enough information in my available context to answer that accurately."*), plus image rules (exact `src`, explicit requests only).

### 2.4 Request protection — `lib/api-guard.ts`

- Runs before any embedding/LLM spend: JSON shape, `user`/`assistant`-only roles (client `system` messages rejected), per-message and total history caps (413), conversation length cap, per-IP sliding-window rate limit (429). `MAX_*`/`RATE_LIMIT_PER_MIN` are optional env with documented defaults; the limiter is in-memory per instance.
- Failures return safe `{ error }` JSON; internals are logged server-side only.

### 2.5 Orchestration — `lib/pipeline.ts`

`runPipeline(messages, options)` returns `{ query, merged, category, context, timings }` — prep + retrieval timed, ready for observability. `category` is only ever an explicit caller-supplied filter.

---

## 3. Edge-Case Handling (verified)

The eval suite (`scripts/eval/scenarios.ts`, 24 scenarios) covers:

- **Projects**: listing, "tell me about X", specific project names
- **Roles**: companies, full timeline, internships, current role, **typos** (`"what os his secound role?"`)
- **Facts / skills**: who-is, education, technologies, unsupported topics (hobbies → decline)
- **Interviews**: strengths, tell-me-about-yourself
- **Empty knowledge**: "What do people say…?" (testimonials are empty) → must decline, not invent
- **Off-topic**: jokes, geography → must decline
- **Multi-turn**: bare `"and"`, continuation (`"and his skills?"`), `"the X one"`, consistency across turns

**Result — retrieval phase (`npm run eval:retrieve`, file-level Recall, live):**

mean R@1 ≈ 0.63, R@3 ≈ 0.85, R@8 ≈ 0.96 — gate passes (every KB-backed scenario retrieves ≥1 relevant doc in top 8).

**Result — answer phase (`npm run eval:answer`, key-fact + decline checks, live):**

20/24. The 4 misses are retrieval-coverage gaps on broad list queries (a role/project chunk missing from the top 8), tracked by the retrieval metrics above — not prompt failures.

---

## 4. Features

**Frontend** (`app/page.tsx`):
- Streaming chat (`useChat` from the `ai` SDK), markdown + tables, photos on request
- Light/dark theme toggle, responsive layout

**Retrieval & answers**:
- Entry-preserving ingestion (one role/project/photo/answer per chunk, labels kept)
- RRF hybrid search without duplicate scoring
- Graceful decline for unknown/empty info via the canonical uncertainty reply
- Consistent answers across multi-turn conversations

**Operations**:
- One-command ingestion (`npm run ingest:pg`) that rebuilds the table
- Eval harness: `npm run eval:retrieve` (recall metrics + gate) and `npm run eval:answer` (LLM answer checks; `EVAL_SEARCH=vector|hybrid`, default hybrid)
- Latency benchmark: `npm run test:latency`
- Unit tests: `npm test` (vitest, all offline-mocked)

---

## 5. Performance (measured live, `npm run test:latency`)

| Stage | Typical cost |
|---|---|
| Query prep (deterministic) | **< 1 ms** |
| Embedding (Gemini) | ~380 ms |
| Retrieval (exact scan, warm) | ~2 ms vector / ~2 ms hybrid |
| LLM generation | streamed (first token ~1–3 s, provider-dependent) |

No LLM rewrite in the request path means the first pipeline stage is effectively free.

---

## 6. Configuration (`.env`)

Copy `.env.example`. Every `REQUIRED` variable is validated at load — the app refuses to boot if any are missing or invalid. No silent fallbacks.

```
# Required:
DATABASE_URL               # Postgres connection string
ASTRA_DB_COLLECTION        # legacy name: the pgvector table name (plain SQL identifier, validated)
GOOGLE_API_KEY             # Gemini embeddings key
EMBEDDING_MODEL            # e.g. gemini-embedding-001
RETRIEVAL_LIMIT            # chunks per answer (8)
LLM_BASE_URL               # any OpenAI-compatible API
LLM_API_KEY                # provider key
LLM_MODEL                  # model id
LLM_MAX_TOKENS             # output cap
LLM_MAX_HISTORY_TURNS      # turns sent to the LLM
LLM_TEMPERATURE            # sampling temperature
# Optional (defaults):
MAX_MESSAGE_CHARS=2000
MAX_MESSAGES=30
MAX_HISTORY_CHARS=12000
RATE_LIMIT_PER_MIN=20
LLM_DISABLE_THINKING=false
CHUNK_SIZE=1000            # oversized-entry safety net only
CHUNK_OVERLAP=200
```

---

## 7. What Makes It Unique

1. **No LLM query rewriting** — pure deterministic follow-up classification; the old token-count heuristic was replaced after it merged standalone short questions.
2. **No category router** — centroid routing was measured (65% accuracy, extra scan per turn) and removed in favor of unfiltered top-k with a diversity cap. Evidence over intuition.
3. **Entry-preserving ingestion** — chunks are logical YAML entries with labels, never mid-field character splits; empty files yield zero chunks so decline paths stay intact.
4. **Evidence-driven tuning** — every retrieval decision (exact scan, RRF rewrite, per-source cap) was validated by live measurement, including reproducing both ANN index failures on the installed stack.
5. **Safety net fallbacks everywhere** — filtered → unfiltered retry; missing info → canonical decline; rate limits → 429 JSON; legacy indexes → dropped on boot.
6. **Retrieval measured separately from answers** — Recall@1/@3/@8 with a hit-rate gate catches what answer substring checks hide (e.g. right answer from the wrong document).
7. **Boring operations** — strict env validation, structured logs, one ingestion command, mocked unit tests, reproducible eval commands.

---

## 8. Known Limitations & Roadmap

- **Broad list queries** can miss a chunk (4/24 answer misses) — embedding-rank quality on a tiny corpus; tracked by retrieval metrics.
- **Rate limiter is in-memory per instance** — needs shared storage for serverless/multi-instance deploys. No multi-user sessions/auth on the API.
- **No ANN index** — exact scan is correct and fast now; migrate to `halfvec` + HNSW (with a quality comparison) past a few thousand chunks.
- **Single-level categories** (first path segment); equal-score ordering follows row ids, so re-ingestion can reshuffle near-ties.
- **Future**: shared rate-limit storage, answer caching, conversation memory beyond the request window.
