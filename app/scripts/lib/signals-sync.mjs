// Shared helpers for the Supabase sync scripts (migrate.mjs full backfill + sync.mjs
// incremental job). Keeping this logic in one place avoids duplicating the
// local-db-read / embed / upsert pipeline across both scripts.
//
// This file only ever READS from the local sql.js-backed sqlite file that `mcp/`
// owns and writes to. It must never write to it.

import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import { appendFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { vectorize } from '../../src/lib/vector/embedding.mjs'

const DATA_DIR = join(homedir(), 'Documents', 'alexandria', 'data')
const DB_PATH = join(DATA_DIR, 'alexandria.db')
const LOG_DIR = join(DATA_DIR, 'logs')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Opens the local mcp-owned sqlite file, readonly.
 *
 * `mcp/lib/db.ts` keeps the whole db in memory (sql.js) and only persists it via a
 * full-file rewrite (`writeFileSync`) on save — that rewrite isn't atomic, so a
 * reader can, in rare cases, catch the file mid-write and see a truncated/corrupt
 * image. We retry once after a short delay before giving up; callers should treat
 * a thrown error here as "try again next scheduled run", not a hard failure.
 */
export async function openLocalDb({ retries = 1, delayMs = 300 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const db = new Database(DB_PATH, { readonly: true, fileMustExist: true })
      // Sanity check — makes sure we didn't just open a truncated/partial file.
      db.prepare("SELECT COUNT(*) FROM signals").get()
      return db
    } catch (err) {
      lastErr = err
      if (attempt < retries) await sleep(delayMs)
    }
  }
  throw lastErr
}

export function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
}

/**
 * Maps a raw local `signals` row into the shape Supabase's `signals` table expects.
 *
 * Returns null for rows whose payload is not valid JSON — those are legacy rows
 * written before encryption was removed (AES ciphertext). Upserting them would
 * overwrite the good copy already in Supabase with empty arrays, so callers must
 * skip them instead.
 */
export function mapRowToSupabase(row) {
  let parsed
  try { parsed = JSON.parse(row.encrypted) } catch { return null }

  return {
    id: row.id,
    proyecto: row.proyecto,
    contexto: row.contexto || '',
    tema: row.tema || 'otro',
    stack: JSON.parse(row.stack || '[]'),
    decisiones: parsed.decisiones || [],
    preferencias: parsed.preferencias || [],
    errores_resueltos: parsed.errores_resueltos || [],
    modelo: row.modelo || '',
    skill: row.skill || '',
    fecha: row.fecha,
  }
}

/** Computes the OpenAI embedding for a raw local `signals` row. */
export async function vectorizeText(row) {
  // Note: `row.stack` here is intentionally the raw JSON-string column (not parsed)
  // — that's how the original migrate.mjs built the embedding text, kept as-is to
  // avoid changing embeddings for rows that get re-synced.
  const text = [row.proyecto, row.contexto, row.tema, row.stack].filter(Boolean).join(' ')
  return vectorize(text)
}

/** Upserts a mapped row + embedding into Supabase's `signals` table. Dedupes by `id`. */
export async function upsertToSupabase(supabase, mappedRow, embedding) {
  const { error } = await supabase
    .from('signals')
    .upsert({ ...mappedRow, embedding }, { onConflict: 'id' })

  if (error) throw new Error(error.message)
}

/** Returns the subset of `ids` that already exist in Supabase's `signals` table. */
export async function fetchExistingIds(supabase, ids) {
  const { data, error } = await supabase.from('signals').select('id').in('id', ids)
  if (error) throw new Error(error.message)
  return new Set((data || []).map((r) => r.id))
}

const SYNC_CURSOR_KEY = 'signals_sync_cursor'

/** Reads the last-synced local `created_at` (epoch seconds) from Supabase's model_state. */
export async function getSyncCursor(supabase) {
  const { data, error } = await supabase
    .from('model_state')
    .select('value')
    .eq('key', SYNC_CURSOR_KEY)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.value ? Number(data.value) : 0
}

/** Persists the new sync cursor (local `created_at` epoch seconds) to Supabase's model_state. */
export async function setSyncCursor(supabase, createdAt) {
  const { error } = await supabase
    .from('model_state')
    .upsert(
      { key: SYNC_CURSOR_KEY, value: String(createdAt), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) throw new Error(`failed to persist sync cursor: ${error.message}`)
}

function ensureLogDir() {
  mkdirSync(LOG_DIR, { recursive: true })
}

/** Appends a line to the app-level sync log (successful run summaries). */
export function log(line) {
  ensureLogDir()
  appendFileSync(join(LOG_DIR, 'sync.out.log'), `[${new Date().toISOString()}] ${line}\n`)
}

/** Appends a line to the app-level sync error log (skipped rows, aborted runs). */
export function logError(line) {
  ensureLogDir()
  appendFileSync(join(LOG_DIR, 'sync.err.log'), `[${new Date().toISOString()}] ERROR ${line}\n`)
}
