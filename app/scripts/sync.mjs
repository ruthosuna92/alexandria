// Incremental sync: mcp's local sqlite -> Supabase.
//
// Meant to be invoked repeatedly on a schedule (see scripts/launchd/) rather than
// run as a long-lived process — each invocation does one pass and exits.
//
// Failure handling:
//   - Infra-level failures (can't reach Supabase, can't open the local db) abort
//     the whole run *before* the cursor moves, so the next scheduled run retries
//     everything untouched.
//   - A row failure (embedding call, upsert) stops the run without advancing the
//     cursor past it, so the next scheduled run retries from that exact row —
//     transient errors never permanently drop a signal. A permanently failing
//     row therefore blocks sync until fixed, which is deliberate: it shows up in
//     sync.err.log on every run instead of silently disappearing.
//   - Legacy rows whose payload is not JSON (written before encryption removal)
//     are skipped and the cursor moves past them: they can never become
//     parseable, and their good copy already lives in Supabase.
import 'dotenv/config'
import {
  openLocalDb,
  createSupabaseClient,
  getSyncCursor,
  setSyncCursor,
  fetchExistingIds,
  mapRowToSupabase,
  vectorizeText,
  upsertToSupabase,
  log,
  logError,
} from './lib/signals-sync.mjs'

async function run() {
  let db
  try {
    db = await openLocalDb({ retries: 1, delayMs: 300 })
  } catch (err) {
    logError(`could not open local db (possibly mid-write by mcp) — will retry next scheduled run: ${err.message}`)
    return
  }

  try {
    let supabase
    let cursor
    try {
      supabase = createSupabaseClient()
      cursor = await getSyncCursor(supabase)
    } catch (err) {
      logError(`could not reach Supabase, aborting run without advancing cursor: ${err.message}`)
      return
    }

    let rows
    try {
      // Inclusive (>=) so rows saved in the same second as the cursor are never
      // lost — created_at has second resolution. Already-synced boundary rows
      // are filtered out below via their ids.
      rows = db
        .prepare(`SELECT * FROM signals WHERE contexto != 'overview' AND created_at >= ? ORDER BY created_at ASC`)
        .all(cursor)
    } catch (err) {
      logError(`failed to query local signals since cursor ${cursor}: ${err.message}`)
      return
    }

    if (!rows.length) return

    let alreadySynced = new Set()
    const boundaryIds = rows.filter((r) => r.created_at === cursor).map((r) => r.id)
    if (boundaryIds.length) {
      try {
        alreadySynced = await fetchExistingIds(supabase, boundaryIds)
      } catch (err) {
        logError(`could not check already-synced boundary rows, aborting run without advancing cursor: ${err.message}`)
        return
      }
    }

    let processed = 0
    let legacySkipped = 0
    let latestCursor = cursor

    for (const row of rows) {
      if (row.created_at === cursor && alreadySynced.has(row.id)) continue

      const mapped = mapRowToSupabase(row)
      if (!mapped) {
        legacySkipped++
        logError(`row ${row.id}: payload is not JSON (legacy encrypted row) — skipping permanently`)
        latestCursor = row.created_at
        continue
      }

      try {
        const embedding = await vectorizeText(row)
        await upsertToSupabase(supabase, mapped, embedding)
        processed++
        latestCursor = row.created_at
      } catch (err) {
        logError(`row ${row.id}: ${err.message} — stopping run; next run retries from cursor ${latestCursor}`)
        break
      }
    }

    if (latestCursor > cursor) {
      await setSyncCursor(supabase, latestCursor)
    }

    log(`sync complete: ${processed} processed, ${legacySkipped} legacy rows skipped, cursor=${latestCursor}`)
  } finally {
    db.close()
  }
}

run().catch((err) => {
  logError(`unexpected crash: ${err.stack || err.message}`)
  process.exitCode = 1
})
