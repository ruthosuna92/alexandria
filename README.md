# 🏛️ Alexandria

> AI context that compounds instead of evaporating.

Alexandria is a local-first RAG system I built to solve a real problem: every AI conversation starts from zero. The reasoning, decisions, and context from hundreds of previous sessions just disappear.

I built this for myself. It lives on my machine, indexes my AI conversations, and makes them queryable — semantically, across languages, in milliseconds.

---

## How it works

1. **Capture** — At the end of any Claude, ChatGPT, or Gemini session, a prompt template extracts structured signals (decisions, patterns, context) as JSON.
2. **Vectorize** — The signals are embedded using multilingual sentence transformers and stored in a local vector index alongside a SQLite database.
3. **Query** — A hybrid search (text + semantic) retrieves the most relevant context. A ranking arbiter decides whether to return one result, combine two, or return nothing (low confidence).
4. **Inject** — The retrieved context block gets pasted into the next session, giving the model memory of past reasoning.
5. **MCP Server** — A connected MCP server exposes three tools (`alexandria_query`, `alexandria_save`, `alexandria_suggest_model`) so Claude Desktop and Gemini CLI can query Alexandria directly mid-conversation.

---

## Architecture decisions

**Local-first by design.** No cloud dependency, no API keys for the core loop. Embeddings run locally via `paraphrase-multilingual-MiniLM-L12-v2` (Xenova/transformers). Vector index persists to disk via Vectra. Database is SQLite via better-sqlite3.

**Machine-bound encryption.** Stored signals are encrypted with AES-256-GCM keyed to the machine ID. This is intentional — the data is personal context, and I wanted it to be meaningless if the files were copied elsewhere.

**Multilingual from the start.** The lexicon covers 20 semantic groups across Spanish and English. Queries work in either language or mixed.

**Ranking arbiter.** The retrieval layer doesn't just return top-k. It classifies the query as `single` (one clear winner), `combined` (two distinct topics), or `none` (low confidence, don't inject noise). This prevents context pollution.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, React |
| API | Next.js API routes (7 endpoints) |
| Vector search | Vectra (local disk), multilingual embeddings |
| Database | SQLite via better-sqlite3 |
| Encryption | AES-256-GCM, machine-ID keyed |
| MCP Server | Node.js, 3 tools |
| AI integrations | Claude Desktop, Gemini CLI |

---

## API surface
GET  /api/query        → hybrid semantic search

POST /api/signals      → ingest and vectorize new signals

GET  /api/lexicon      → multilingual semantic groups

POST /api/prompt       → generate capture prompt for AI sessions

GET  /api/merge-check  → deduplication before save

GET  /api/meta         → index stats

POST /api/feedback     → signal quality feedback
---

## Running it

This is a personal tool — the encryption is tied to the machine it was set up on, so cloning and running it as-is won't work out of the box. The architecture is documented here for reference. A portable version with configurable env-based encryption is on the roadmap.

```bash
npm install
npm run seed   # seeds the multilingual lexicon
npm run dev    # starts on localhost:3001
```

---

## Roadmap

- [ ] Supabase adapter (pgvector) — cross-device sync
- [ ] Portable encryption (env-based, not machine-keyed)
- [ ] Editable routing table from UI
- [ ] Tauri desktop app (.exe / .dmg installer)
- [ ] HTTP adapter for ChatGPT MCP compatibility

---

## Why I built this

I use Claude Code, Cursor, and Gemini CLI daily. The problem isn't the tools — it's that every session is amnesiac. I wanted something that made my past reasoning reusable without sending my data to a third party. Alexandria is that.

The name is obvious in retrospect.
