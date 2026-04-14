import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

const DATA_DIR = path.join(os.homedir(), 'Documents', 'alexandria', 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'alexandria.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  initSchema(_db)
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
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
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS lexicon (
      id TEXT PRIMARY KEY,
      terms TEXT NOT NULL,
      domain TEXT DEFAULT 'general',
      langs TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_signals_proyecto ON signals(proyecto);
    CREATE INDEX IF NOT EXISTS idx_signals_tema ON signals(tema);
    CREATE INDEX IF NOT EXISTS idx_lexicon_domain ON lexicon(domain);
  `)
}
