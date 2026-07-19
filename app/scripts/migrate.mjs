// One-off / manual full backfill: re-embeds and re-upserts EVERY local signal into
// Supabase, ignoring the incremental sync cursor. Kept as an escape hatch for
// re-running a full resync by hand (e.g. after a schema change) — for normal
// day-to-day syncing use `npm run sync` / the scheduled job in scripts/launchd/.
import 'dotenv/config'
import {
  openLocalDb,
  createSupabaseClient,
  mapRowToSupabase,
  vectorizeText,
  upsertToSupabase,
} from './lib/signals-sync.mjs'

async function migrate() {
  const supabase = createSupabaseClient()
  const db = await openLocalDb()

  try {
    const signals = db.prepare("SELECT * FROM signals WHERE contexto != 'overview'").all()
    console.log(`Migrating ${signals.length} signals...`)

    for (const s of signals) {
      try {
        const mapped = mapRowToSupabase(s)
        if (!mapped) {
          console.log(`⏭️  ${s.id}: legacy encrypted row — skipped (would overwrite Supabase copy with empty data)`)
          continue
        }
        const embedding = await vectorizeText(s)
        await upsertToSupabase(supabase, mapped, embedding)
        console.log(`✅ ${s.proyecto} — ${s.contexto?.slice(0, 50)}`)
      } catch (err) {
        console.error(`❌ ${s.id}:`, err.message)
      }
    }

    console.log('Migration complete')
  } finally {
    db.close()
  }
}

migrate()
