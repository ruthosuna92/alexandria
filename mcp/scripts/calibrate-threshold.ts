// Measures how well the arbiter's relevance threshold separates queries that
// have a matching signal from queries that don't. Re-run after changing the
// embedding model or the scoring weights:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... OPENAI_API_KEY=... npx tsx scripts/calibrate-threshold.ts
//
// Relevant queries are paraphrased on purpose (not copied from the signals)
// so the test reflects how searches are actually phrased.
import { fetchCandidates, RELEVANCE_THRESHOLD } from '../lib/arbiter.js'

const RELEVANT: Array<{ q: string; proyecto: string }> = [
  { q: 'cómo resolvimos la race condition del visor de nubes de puntos', proyecto: 'Spybee' },
  { q: 'filtros que se quedaban pegados en incidencias', proyecto: 'Spybee' },
  { q: 'diseño del módulo de daily logs', proyecto: 'Spybee' },
  { q: 'levantar el backend hono en windows', proyecto: 'Spybee' },
  { q: 'panel de configuración de potree', proyecto: 'Spybee' },
  { q: 'therapist finder catalog design', proyecto: 'MindMatch' },
  { q: 'agent matching round robin por género', proyecto: 'HomeJourneyAI' },
  { q: 'quién es Carlson y cómo empezó el proyecto freelance', proyecto: 'HomeJourneyAI' },
  { q: 'plan para llegar a 5 mil dólares al mes', proyecto: 'Roadmap $5K — Personal Brand & Products' },
  { q: 'comparación de Gemini CLI y Codex CLI', proyecto: 'Exploración herramientas AI' },
  { q: 'inyección SQL en el MCP', proyecto: 'Alexandria' },
  { q: 'migrar a pgvector y desplegar en vercel', proyecto: 'Alexandria' },
  { q: 'árbitro de ranking del MCP', proyecto: 'Alexandria' },
  { q: 'de qué trata el aquelarre', proyecto: 'el-aquelarre' },
]

const IRRELEVANT: string[] = [
  'receta de pan de banano',
  'cómo configurar un router TP-Link',
  'historia del imperio romano',
  'mejores ejercicios para la espalda',
  'precio del bitcoin hoy',
  'configurar Kubernetes en AWS EKS',
  'Flutter state management con Riverpod',
  'Django ORM migrations',
  'auth con Clerk en Next.js',
  'optimizar consultas en MongoDB',
]

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

const relevant = []
for (const { q, proyecto } of RELEVANT) {
  const [top] = await fetchCandidates(q)
  relevant.push({ q, score: top?.compositeScore ?? 0, vector: top?.vectorScore ?? 0, correct: !!top && same(top.proyecto, proyecto), got: top?.proyecto })
}
const irrelevant = []
for (const q of IRRELEVANT) {
  const [top] = await fetchCandidates(q)
  irrelevant.push({ q, score: top?.compositeScore ?? 0, vector: top?.vectorScore ?? 0, got: top?.proyecto })
}

const fmt = (n: number) => n.toFixed(3)
console.log('\nRELEVANT (score | vector | top project ok?)')
for (const r of relevant) console.log(`  ${fmt(r.score)} | ${fmt(r.vector)} | ${r.correct ? 'ok ' : 'BAD'} ${r.got ?? '-'} — ${r.q}`)
console.log('\nIRRELEVANT (score | vector | top project)')
for (const r of irrelevant) console.log(`  ${fmt(r.score)} | ${fmt(r.vector)} | ${r.got ?? '-'} — ${r.q}`)

console.log(`\ncurrent RELEVANCE_THRESHOLD = ${RELEVANCE_THRESHOLD}`)
console.log('threshold | relevant kept (correct) | irrelevant leaked')
for (let t = 0.15; t <= 0.451; t += 0.025) {
  const kept = relevant.filter(r => r.score >= t)
  const leaked = irrelevant.filter(r => r.score >= t).length
  console.log(`  ${t.toFixed(3)}   | ${String(kept.length).padStart(2)}/${relevant.length} (${kept.filter(r => r.correct).length})            | ${leaked}/${irrelevant.length}`)
}
