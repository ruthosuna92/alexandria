import OpenAI from 'openai'

let _openai: OpenAI | null = null

function getOpenAI() {
  if (_openai) return _openai
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

export async function vectorize(text: string): Promise<number[]> {
  const openai = getOpenAI()
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // límite seguro
  })
  return response.data[0].embedding
}

export async function queryIndex(
  db: ReturnType<typeof import('@/lib/db').getDb>,
  vector: number[],
  topK = 6,
  filters: { proyecto?: string; tema?: string; stack?: string } = {}
): Promise<Array<{ id: string; score: number }>> {
  let query = db
    .rpc('match_signals', {
      query_embedding: vector,
      match_count: topK,
    })

  const { data, error } = await query
  if (error || !data) return []

  return data
    .filter((r: any) => {
      if (filters.proyecto && r.proyecto !== filters.proyecto) return false
      if (filters.tema && r.tema !== filters.tema) return false
      if (filters.stack && !JSON.stringify(r.stack).includes(filters.stack)) return false
      return true
    })
    .map((r: any) => ({ id: r.id, score: r.similarity }))
}