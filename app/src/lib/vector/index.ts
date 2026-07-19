export { vectorize } from './embedding.mjs'

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