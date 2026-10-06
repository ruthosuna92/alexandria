# 🏛️ Alexandria

> AI context that compounds instead of evaporating.

Alexandria is a personal RAG system I built to solve a real problem: every AI conversation starts from zero. The reasoning, decisions, and context from hundreds of previous sessions just disappear.

I built this for myself. It indexes my AI conversations in my own Supabase project and makes them queryable — semantically, across languages, from any device.

---

## How it works

1. **Capture** — At the end of any Claude, ChatGPT, or Gemini session, a prompt template extracts structured signals (decisions, patterns, context) as JSON.
2. **Vectorize** — The signals are embedded with OpenAI `text-embedding-3-small` and stored in Supabase Postgres with pgvector.
3. **Query** — A hybrid search (text + semantic) retrieves the most relevant context. A ranking arbiter decides whether to return one result, combine two, or return nothing (low confidence).
4. **Inject** — The retrieved context block gets pasted into the next session, giving the model memory of past reasoning.
5. **MCP Server** — A connected MCP server exposes four tools (`alexandria_query`, `alexandria_save`, `alexandria_suggest_model`, `alexandria_regenerate_overview`) so Claude Code, Claude Desktop and Gemini CLI can query and save to Alexandria directly mid-conversation.

---

## Architecture decisions

**One source of truth.** The web app and the MCP server read and write the same Supabase database. An earlier version kept a local SQLite + vector index on disk and synced it to Supabase; two copies of the data meant they drifted, so the MCP now talks to Supabase directly.

**One embedding model.** Both sides embed with the same OpenAI model and truncation. pgvector similarity is only meaningful when query and stored vectors come from the same model, so both copies carry a comment saying they must stay in sync.

**Multilingual from the start.** The lexicon covers 20 semantic groups across Spanish and English. Queries work in either language or mixed.

**Ranking arbiter.** The retrieval layer doesn't just return top-k. It classifies the query as `single` (one clear winner), `combined` (two distinct topics), or `none` (low confidence, don't inject noise). This prevents context pollution.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, React |
| API | Next.js API routes |
| Database | Supabase (Postgres) |
| Vector search | pgvector (`match_signals` RPC) |
| Embeddings | OpenAI `text-embedding-3-small` |
| MCP Server | Node.js, 4 tools, stdio |
| AI integrations | Claude Code, Claude Desktop, Gemini CLI |

---

## API surface

```
POST   /api/query        → hybrid semantic search
GET    /api/signals      → list signals
POST   /api/signals      → ingest and vectorize a new signal
DELETE /api/signals      → delete a signal
GET    /api/lexicon      → multilingual semantic groups (also POST / DELETE)
GET    /api/prompt       → generate capture prompt for AI sessions
POST   /api/merge-check  → deduplication before save
GET    /api/meta         → index stats
POST   /api/feedback     → signal quality feedback
```

---

## Running it

You need a Supabase project with the `signals`, `lexicon`, `model_state`, `feedback`, `learned_synonyms` and `merge_feedback` tables and the `match_signals` function, plus an OpenAI API key.

```bash
cd app
# create .env with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY,
#   ALEXANDRIA_USER and ALEXANDRIA_PASSWORD (app login)
npm install
npm run dev            # starts on localhost:3001
```

The MCP server setup lives in [`mcp/README.md`](mcp/README.md).

---

## Roadmap

- [x] Supabase adapter (pgvector) — cross-device sync
- [ ] Editable routing table from UI
- [ ] Tauri desktop app (.exe / .dmg installer)
- [ ] HTTP adapter for ChatGPT MCP compatibility

---

## Why I built this

I use Claude Code, Cursor, and Gemini CLI daily. The problem isn't the tools — it's that every session is amnesiac. I wanted something that made my past reasoning reusable without sending my data to a third party. Alexandria is that.

The name is obvious in retrospect.
