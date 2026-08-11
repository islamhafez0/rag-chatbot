# RAG Career Chatbot — Complete Report

A RAG (Retrieval-Augmented Generation) chatbot that answers questions about Islam Hafez's career from a personal knowledge base. Built with Next.js, Astra DB, Gemini embeddings, and Groq LLM.

---

## 1. System Overview

```
┌─────────────┐   POST /api/chat    ┌──────────────────────────────────────────┐
│   Browser   │ ──────────────────► │            Next.js (App Router)          │
│  chat UI    │ ◄────────────────── │  app/api/chat/route.ts                  │
└─────────────┘   streaming (SSE)   │                                          │
                                    │  lib/pipeline.ts  (orchestrator)         │
                                    │    ├─ buildRetrievalQuery   (query prep) │
                                    │    ├─ routeByVectors        (optional)   │
                                    │    ├─ getContext            (retrieval)  │
                                    │    └─ generateAnswer / Stream (LLM)     │
                                    └──────────────────────────────────────────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              ▼                     ▼                     ▼
                     ┌──────────────┐     ┌──────────────────┐   ┌─────────────┐
                     │  Astra DB    │     │  Google Gemini   │   │    Groq     │
                     │  Vector DB   │◄────│  Embeddings (3072│   │  LLM (chat) │
                     │  career_vectors│    │  dim)            │   │  streaming  │
                     └──────────────┘     └──────────────────┘   └─────────────┘
                              ▲
                              │ scripts/loadYaml.ts (ingestion from career_brain/)
```

**Knowledge base (`career_brain/`)**: 11 YAML files organized into 6 folders → 15 chunks in the vector DB:

| Category | Content | Chunks |
|---|---|---|
| `roles` | current + previous roles, timelines, companies | 5 |
| `projects` | RAG chatbot, YouTube clone, Gemini AI, template | 5 |
| `facts` | profile + skills | 2 |
| `interviews` | common answers (strengths, tell-me-about-yourself) | 1 |
| `rules` | personality / how-to-answer rules | 1 |
| `feedback` | testimonials (currently empty) | 1 |

---

## 2. The RAG Pipeline

### 2.1 Query preparation — `lib/query.ts` (deterministic, zero LLM)

No LLM query rewriting. Pure rule-based logic:

- **Degenerate follow-up detection** (`isDegenerateFollowUp`): bare particles (`and`, `then`, `more`, `tell me more`, `go on`…), strings ≤2 tokens, and referential noun phrases (`the X one`, `what about the X one?`).
- **Merging** (`buildRetrievalQuery`): a degenerate follow-up is merged with the previous user question (`"Tell me about the RAG chatbot"` + `"and"` → `"Tell me about the RAG chatbot and"`). Self-contained questions pass through untouched.
- Cost: **sub-millisecond**. No hallucination risk, no extra latency, no extra tokens.

### 2.2 Category routing — data-driven, nothing hardcoded

- Every chunk is tagged at ingestion with `category` = its first folder path segment, plus `type` and `title`.
- `getCategoryVectors()` reads live `{category, $vector}` from the collection (cached in-process, handles Astra's `DataAPIVector` wrapper). **Adding a new folder = automatic new category; no code changes.**
- `routeByVectors()` scores each category by mean cosine similarity and applies a confidence gate (threshold + margin) — when unsure it returns `null` and retrieval runs unfiltered rather than risk narrowing.
- **Default is unfiltered** (`ROUTER=none`): with limit 8 on this corpus, unfiltered top-k already captures complete role/project context, and the eval proved it equal-or-better than filtering. Enable `ROUTER=vector` when the KB grows past ~50–100 chunks.
- A safety fallback: if a filtered search returns <2 docs, it silently retries unfiltered.

### 2.3 Retrieval — `lib/astra.ts` (vector-only by default, hybrid opt-in)

- `embedText()` embeds the query with Gemini (`gemini-embedding-001`, 3072-dim) via LangChain.
- `getContext()` runs **vector-only** search (`find` + `$vector`, p50 **~240ms**) by default. A **hybrid** mode (`$hybrid` vector + `$lexical` full-text, reranked lexically via `rerankOn: $lexical`, p50 ~580ms) is available via `{ search: "hybrid" }` for exact-name precision when needed.
- Why vector-only won: the 23-scenario answer eval scores **23/23 with both strategies**, so the ~350ms/turn saving is free precision-wise. (Names like "TaqaTechno" already hit precisely because they dominate the tiny, homogeneous corpus.)
- Safety nets: hybrid falls back to vector-only if unavailable; a category filter that yields <2 docs retries unfiltered.
- Returns `{ text, sources }`; default limit **8** (was 5 — the single change that eliminated role-timeline answer contradictions).

### 2.4 Generation — `lib/generate.ts` (OpenAI-compatible, streaming)

- Provider is any OpenAI-compatible API, configured strictly via required env (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`) — no fallbacks. Currently OpenCode Zen (`deepseek-v4-flash-free`).
- Output capped at `LLM_MAX_TOKENS` (512), history window `LLM_MAX_HISTORY_TURNS` (6), `LLM_TEMPERATURE` (0.3) — all validated at load.
- Streamed to the client via the `ai` SDK `OpenAIStream`; first-token timing surfaced through `onFirstToken` for TTFT measurement.
- `buildSystemPrompt` encodes the assistant rules:
  - BE SPECIFIC (use exact names, tech stacks, dates)
  - NO META-TALK / NO HEDGING ("Based on the context…" is forbidden)
  - CONSISTENCY across turns (never contradict earlier facts)
  - COMPLETENESS (check context before declaring something missing)
  - Explicit decline string for unknown info: *"I don't have that specific information in my knowledge base yet."*
- Non-stream `generateAnswer()` exists for the eval harness.

### 2.5 Orchestration — `lib/pipeline.ts`

`runPipeline(messages, options)` returns `{ query, merged, category, routeScore, routeRunnerUp, context, timings }` — every stage timed, ready for observability.

---

## 3. Edge-Case Handling (verified)

The eval suite (`scripts/eval/scenarios.ts`, 23 golden scenarios) covers:

- **Projects**: listing, "tell me about X", specific project names
- **Roles**: companies, full timeline, internships, current role, **typos** (`"what os his secound role?"`)
- **Facts / skills**: who-is, education, technologies
- **Interviews**: strengths, tell-me-about-yourself
- **Empty knowledge**: "What do people say…?" (testimonials are empty) → must decline, not invent
- **Off-topic**: jokes, geography → must decline
- **Multi-turn**: bare `"and"`, pronoun follow-ups (`"and his skills?"`), `"the X one"`, consistency across turns

**Result — answer phase (Groq 8b, key-fact + decline checks):**

| Router | Pass rate |
|---|---|
| `none` (unfiltered) | **23/23 (100%)** |
| `vector` routing | **23/23 (100%)** |

During tuning the eval caught real issues: centroid routing misroutes on this small homogeneous corpus (65% routing accuracy), so unfiltered won on answer quality — evidence-based decision, not guesswork. Caches (`scripts/eval/.cache/`) make reruns instant and avoid re-embedding/re-calling the LLM.

---

## 4. Features

**Frontend** (`app/page.tsx`):
- Streaming chat (`useChat` from the `ai` SDK) with typing indicator
- Auto-scroll, Enter-to-send (Shift+Enter for newline), auto-growing textarea
- Light/dark theme toggle, branded logo, responsive layout

**Retrieval & answers**:
- Hybrid vector + lexical search with lexical rerank
- Data-driven category metadata (add content → no code changes)
- Graceful decline for unknown/empty info (never hallucinates from thin air)
- Consistent answers across multi-turn conversations

**Operations**:
- One-command ingestion (`npm run load:yaml` equivalent via `scripts/loadYaml.ts`) that re-embeds changed files only
- Eval harness: `npm run eval:retrieve` (routing analysis) and `npm run eval:answer` (LLM answer checks)
- Latency benchmark: `npm run test:latency`

---

## 5. Performance

| Stage | Typical cost |
|---|---|
| Query prep (deterministic) | **< 1 ms** |
| Embedding (Gemini) | ~310 ms |
| Retrieval (hybrid + rerank, warm) | ~450 ms |
| Vector routing (optional) | +~350 ms (embedding is shared with retrieval) |
| LLM generation | streamed (first token ~0.3–2 s) |

No LLM rewrite in the request path means the first pipeline stage is effectively free.

---

## 6. Configuration (`.env`)

Every variable is **required** — the app validates them at load time and refuses to function if any are missing or invalid. No silent fallbacks.

```
ASTRA_DB_API_ENDPOINT        # Astra DB endpoint
ASTRA_DB_APPLICATION_TOKEN   # Astra DB token
ASTRA_DB_NAMESPACE           # keyspace
ASTRA_DB_COLLECTION          # collection name
GOOGLE_API_KEY               # Gemini embeddings key
EMBEDDING_MODEL              # e.g. gemini-embedding-001
ROUTER                       # "none" | "vector"
# LLM provider (any OpenAI-compatible API — Zen, Groq, ...):
LLM_BASE_URL                 # e.g. https://opencode.ai/zen/v1 or https://api.groq.com/openai/v1
LLM_API_KEY                  # provider key
LLM_MODEL                    # e.g. deepseek-v4-flash-free
# LLM tuning:
LLM_MAX_TOKENS               # output cap (512)
LLM_MAX_HISTORY_TURNS        # last N messages sent to the LLM (6)
LLM_TEMPERATURE              # (0.3)
# Retrieval / routing (tune as the KB scales):
RETRIEVAL_LIMIT              # chunks per query (8)
ROUTE_THRESHOLD              # routing gate (0.35)
ROUTE_MARGIN                 # routing margin (0.02)
# Ingestion (scripts/loadYaml.ts):
CHUNK_SIZE                   # (1000)
CHUNK_OVERLAP                # (200)
```

---

## 7. What Makes It Unique

1. **No LLM query rewriting** — most RAG bots re-write user queries with an LLM step. We proved that step hallucinates (a bare `"and"` got rewritten into meta-text garbage) and costs 100+ ms/turn. Ours is pure deterministic prep.
2. **Zero hardcoded categories** — categories come from the folder structure at ingest time. Drop a new `resumes/` folder in and it's a first-class routing target automatically. This was the #1 design requirement.
3. **Evidence-driven tuning** — the routing decision was made from a 23-scenario golden eval (routing accuracy + answer key-fact checks), not intuition. Result: unfiltered retrieval won on *this* corpus, and the vector router stays as a validated opt-in for scaling.
4. **Latency-tuned retrieval** — vector-only search is default (p50 ~240ms, 23/23 eval) with hybrid+rerank as an opt-in for exact-name precision on a bigger corpus; the choice was made by measuring, not guessing.
5. **Safety net fallbacks everywhere** — rerank → vector-only; filtered → unfiltered; missing info → explicit decline; rate limits → friendly 429 message. The pipeline degrades gracefully instead of failing.
6. **Multimodal-ready** — chunk schema already carries `type`/`title` metadata; embeddings and the ingestion path are designed so images, PDFs, and resumes can be added as new types without a rewrite.
7. **Complete evaluation suite** — golden edge-case set, cached score maps, LLM-answer grading. `npm run eval:answer` = 23/23.

---

## 8. Known Limitations & Roadmap

- **Categories are single-level** (first path segment only); nested taxonomies would need a change in `loadYaml.ts`.
- **No multi-user sessions / auth** on the API.
- **Provider rate/token limits** can throttle a model (the eval once used Groq's 8b for speed). Since the provider is config via `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`, fail over by pointing those at another OpenAI-compatible provider — no code change.
- **Future**: multimodal ingestion (images/resumes/PDFs as `type` variants), answer caching, conversation memory beyond the request window, and re-enabling `ROUTER=vector` once the KB scales past ~50–100 chunks.
