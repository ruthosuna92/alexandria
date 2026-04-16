import path from 'path'
import os from 'os'
import fs from 'fs'

const DATA_DIR = path.join(os.homedir(), 'Documents', 'alexandria', 'data')
const DB_PATH  = path.join(DATA_DIR, 'alexandria.db')

let _db: any = null

export async function getDb() {
  if (_db) return _db
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs()
  if (fs.existsSync(DB_PATH)) {
    _db = new SQL.Database(fs.readFileSync(DB_PATH))
  } else {
    throw new Error(`Alexandria DB not found at ${DB_PATH}. Run the Alexandria app first.`)
  }
  return _db
}

export function persist(db: any) {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()))
}

export function getModelState(db: any, key: string): string | null {
  const res = db.exec(`SELECT value FROM model_state WHERE key = '${key}'`)
  return res.length ? res[0].values[0][0] : null
}

export function setModelState(db: any, key: string, value: string) {
  db.run(`INSERT OR REPLACE INTO model_state (key, value, updated_at) VALUES ('${key}', '${value.replace(/'/g, "''")}', strftime('%s','now'))`)
  persist(db)
}
