import path from 'path'
import os from 'os'
import fs from 'fs'

const DATA_DIR = path.join(os.homedir(), 'Documents', 'alexandria', 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'alexandria.db')

let _db: any = null

export async function getDb() {
  if (_db) return _db
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs()

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    _db = new SQL.Database(fileBuffer)
  } else {
    _db = new SQL.Database()
  }

  initSchema(_db)
  persist(_db)
  return _db
}

export function persist(db: any) {
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

function initSchema(db: any) {
  db.run(`
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      proyecto TEXT NOT NULL,
      contexto TEXT,
      tema TEXT,
      stack TEXT,
      modelo TEXT,
      skill TEXT,
      encrypted TEXT NOT NULL,
      vector_id TEXT,
      fecha TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS lexicon (
      id TEXT PRIMARY KEY,
      terms TEXT NOT NULL,
      domain TEXT DEFAULT 'general',
      langs TEXT DEFAULT '[]',
      source TEXT DEFAULT 'manual',
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      signal_id TEXT,
      query TEXT,
      proyecto TEXT,
      tema TEXT,
      modelo TEXT,
      score_coseno REAL,
      fecha INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS merge_feedback (
      id TEXT PRIMARY KEY,
      vector_a TEXT NOT NULL,
      vector_b TEXT NOT NULL,
      texto_a TEXT,
      texto_b TEXT,
      score_coseno REAL,
      proyecto TEXT,
      tema TEXT,
      usuario_dijo TEXT NOT NULL,
      fecha INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS learned_synonyms (
      id TEXT PRIMARY KEY,
      terms TEXT NOT NULL,
      confidence REAL DEFAULT 0,
      source TEXT DEFAULT 'behavior',
      fecha INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS model_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_signals_proyecto ON signals(proyecto);
    CREATE INDEX IF NOT EXISTS idx_signals_tema ON signals(tema);
    CREATE INDEX IF NOT EXISTS idx_feedback_signal ON feedback(signal_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_tipo ON feedback(tipo);
    CREATE INDEX IF NOT EXISTS idx_merge_proyecto ON merge_feedback(proyecto);
  `)

  runMigrations(db)
  persist(db)
}

function runMigrations(db: any) {
  const version = getModelState(db, 'schema_version') || '0'

  if (version === '0') {
    try {
      db.run(`ALTER TABLE lexicon ADD COLUMN source TEXT DEFAULT 'manual'`)
    } catch {}
    setModelState(db, 'schema_version', '1')
  }
}

export function getModelState(db: any, key: string): string | null {
  const res = db.exec(`SELECT value FROM model_state WHERE key = '${key}'`)
  return res.length ? res[0].values[0][0] : null
}

export function setModelState(db: any, key: string, value: string) {
  db.run(`INSERT OR REPLACE INTO model_state (key, value, updated_at) VALUES ('${key}', '${value.replace(/'/g, "''")}', strftime('%s','now'))`)
  persist(db)
}
