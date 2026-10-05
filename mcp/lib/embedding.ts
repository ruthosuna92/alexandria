// Query vectors are compared against embeddings the app stores in Supabase, so
// the model and truncation MUST stay identical to app/src/lib/vector/embedding.mjs.
// Duplicated on purpose: mcp/ and app/ are separate packages with separate builds.
import OpenAI from 'openai'
import { config } from './config.js'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const MAX_INPUT_CHARS = 8000

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (_openai) return _openai
  _openai = new OpenAI({ apiKey: config.openaiApiKey })
  return _openai
}

export async function embed(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, MAX_INPUT_CHARS),
  })
  return response.data[0].embedding
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, ma = 0, mb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; ma += a[i]*a[i]; mb += b[i]*b[i] }
  return dot / (Math.sqrt(ma) * Math.sqrt(mb) || 1)
}
