import path from 'path'
import os from 'os'
import fs from 'fs'

const DATA_DIR  = path.join(os.homedir(), 'Documents', 'alexandria', 'data')
const DB_PATH   = path.join(DATA_DIR, 'alexandria.db')
const LOCK_PATH = path.join(DATA_DIR, 'alexandria.db.lock')

// Grace period before freeing a superseded handle: in-flight operations may
// still hold it across awaits, and closing it under them throws mid-query.
const STALE_HANDLE_CLOSE_MS = 60_000
// A lock older than this belongs to a crashed process and can be stolen.
const STALE_LOCK_MS = 15_000
const LOCK_TIMEOUT_MS = 10_000

let _db: any = null
let _loadedMtimeMs = 0

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getDb() {
  const stat = fs.statSync(DB_PATH, { throwIfNoEntry: false })
  if (!stat) {
    throw new Error(`Alexandria DB not found at ${DB_PATH}. Run the Alexandria app first.`)
  }
  if (_db && stat.mtimeMs === _loadedMtimeMs) return _db

  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs()
  if (_db) {
    const old = _db
    setTimeout(() => old.close(), STALE_HANDLE_CLOSE_MS).unref()
  }
  _db = new SQL.Database(fs.readFileSync(DB_PATH))
  _loadedMtimeMs = stat.mtimeMs
  return _db
}

export function persist(db: any) {
  // Write-then-rename so readers (the other MCP process, the launchd sync job)
  // never observe a half-written file.
  const tmp = DB_PATH + '.tmp'
  fs.writeFileSync(tmp, Buffer.from(db.export()))
  fs.renameSync(tmp, DB_PATH)
  _loadedMtimeMs = fs.statSync(DB_PATH).mtimeMs
}

async function acquireLock() {
  const deadline = Date.now() + LOCK_TIMEOUT_MS
  for (;;) {
    try {
      fs.mkdirSync(LOCK_PATH)
      return
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err
      const stat = fs.statSync(LOCK_PATH, { throwIfNoEntry: false })
      if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
        try { fs.rmdirSync(LOCK_PATH) } catch { /* another process beat us to it */ }
        continue
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for lock on ${DB_PATH}`)
      }
      await sleep(100)
    }
  }
}

function releaseLock() {
  try { fs.rmdirSync(LOCK_PATH) } catch { /* already released */ }
}

/**
 * Runs a read-modify-write cycle against the freshest on-disk state, serialized
 * across processes via a lock dir. Without this, two MCP servers (Claude Desktop
 * + Claude Code) saving concurrently would have the loser's persist() silently
 * erase the winner's rows.
 *
 * `fn` must be synchronous: any await inside it would widen the window the lock
 * is held and reintroduce interleaving within this process. Do async work
 * (vectorize, index updates) before or after the call.
 */
export async function withFreshDb<T>(fn: (db: any) => T): Promise<T> {
  await acquireLock()
  try {
    const db = await getDb() // mtime check reloads if another process wrote
    const result = fn(db)
    persist(db)
    return result
  } finally {
    releaseLock()
  }
}

export function getModelState(db: any, key: string): string | null {
  const res = db.exec(`SELECT value FROM model_state WHERE key = ?`, [key])
  return res.length ? res[0].values[0][0] : null
}

export function setModelState(db: any, key: string, value: string) {
  db.run(`INSERT OR REPLACE INTO model_state (key, value, updated_at) VALUES (?, ?, strftime('%s','now'))`, [key, value])
  persist(db)
}
