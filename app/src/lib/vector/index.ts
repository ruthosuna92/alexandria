import path from 'path'
import os from 'os'
import fs from 'fs'
import { LocalIndex } from 'vectra'

const VECTOR_DIR = path.join(os.homedir(), 'Documents', 'alexandria', 'data', 'vectors')
fs.mkdirSync(VECTOR_DIR, { recursive: true })

let _index: LocalIndex | null = null

async function getIndex(): Promise<LocalIndex> {
  if (_index) return _index
  _index = new LocalIndex(VECTOR_DIR)
  if (!(await _index.isIndexCreated())) {
    await _index.createIndex()
  }
  return _index
}

let _pipeline: any = null

async function getEmbedder() {
  if (_pipeline) return _pipeline
  const { pipeline } = await import('@xenova/transformers')
  _pipeline = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2')
  return _pipeline
}

export async function vectorize(text: string): Promise<number[]> {
  const embedder = await getEmbedder()
  const output = await embedder(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data) as number[]
}

export async function addToIndex(id: string, vector: number[], metadata: Record<string, unknown>) {
  const index = await getIndex()
  await index.upsertItem({ id, vector, metadata })
}

export async function queryIndex(vector: number[], topK = 6): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
  const index = await getIndex()
  const results = await index.queryItems(vector, topK)
  return results.map(r => ({
    id: r.item.id,
    score: r.score,
    metadata: r.item.metadata as Record<string, unknown>
  }))
}

export async function deleteFromIndex(id: string) {
  const index = await getIndex()
  await index.deleteItem(id)
}
