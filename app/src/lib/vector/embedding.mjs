// Single source of truth for the OpenAI embedding pipeline, shared between the
// app's query-side vectorize (src/lib/vector/index.ts) and the sync scripts'
// stored embeddings (scripts/lib/signals-sync.mjs). Plain .mjs so both the
// Next.js build and the node-run scripts can import it.
//
// The model and truncation MUST stay identical on both sides: pgvector
// similarity between a query vector and stored vectors is only meaningful when
// they come from the same model.
import OpenAI from 'openai'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const MAX_INPUT_CHARS = 8000

let _openai = null

function getOpenAI() {
  if (_openai) return _openai
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

export async function vectorize(text) {
  const openai = getOpenAI()
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, MAX_INPUT_CHARS),
  })
  return response.data[0].embedding
}
