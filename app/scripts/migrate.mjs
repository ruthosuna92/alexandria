import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const DB_PATH = join(homedir(), 'Documents', 'alexandria', 'data', 'alexandria.db')
const db = new Database(DB_PATH)

async function vectorize(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000)
  })
  return res.data[0].embedding
}

async function migrate() {
  const signals = db.prepare("SELECT * FROM signals WHERE contexto != 'overview'").all()
  console.log(`Migrando ${signals.length} signals...`)

  for (const s of signals) {
    let parsed = {}
    try { parsed = JSON.parse(s.encrypted) } catch {}

    const text = [s.proyecto, s.contexto, s.tema, s.stack].filter(Boolean).join(' ')
    const embedding = await vectorize(text)

    const { error } = await supabase.from('signals').upsert({
      id: s.id,
      proyecto: s.proyecto,
      contexto: s.contexto || '',
      tema: s.tema || 'otro',
      stack: JSON.parse(s.stack || '[]'),
      decisiones: parsed.decisiones || [],
      preferencias: parsed.preferencias || [],
      errores_resueltos: parsed.errores_resueltos || [],
      modelo: s.modelo || '',
      skill: s.skill || '',
      embedding,
      fecha: s.fecha
    })

    if (error) console.error(`❌ ${s.id}:`, error.message)
    else console.log(`✅ ${s.proyecto} — ${s.contexto?.slice(0, 50)}`)
  }

  console.log('Migración completa')
}

migrate()