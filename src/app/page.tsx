'use client'
import { useState, useEffect, useCallback } from 'react'
import styles from './page.module.css'

const PROMPT_TEMPLATE = `Dame un resumen de esta conversación en formato JSON:
{
  "proyecto": "nombre corto del proyecto (ej: Spybee, Alexandria, EcoRewards)",
  "contexto": "tarea específica (ej: refactor breadcrumbs, fix race condition viewer)",
  "tema": "bug | feature | arquitectura | planning | ui | otro",
  "stack": ["tecnologías", "usadas"],
  "decisiones": ["decisiones importantes tomadas"],
  "preferencias": ["preferencias expresadas"],
  "errores_resueltos": ["bugs resueltos"],
  "modelo_sugerido": "claude-sonnet-4-6 | claude-opus-4-6 | claude-haiku-4-5 | gemini-flash",
  "skill_sugerida": "nextjs.md | plasmo.md | supabase.md | clerk.md | expo.md"
}
Solo el JSON, sin texto adicional ni backticks.`

type Signal = {
  id: string; proyecto: string; contexto: string; tema: string
  stack: string[]; modelo: string; skill: string; fecha: string
  score?: number; parsed: Record<string, any>
}

type LexiconGroup = { id: string; terms: string[]; domain: string; langs: string[] }
type Meta = { total: number; projects: number; topics: number; proyectos: string[]; temas: string[]; stacks: string[] }

const MODEL_COLORS: Record<string, string> = {
  'claude-sonnet-4-6': '#1D9E75', 'claude-opus-4-6': '#7F77DD',
  'claude-haiku-4-5': '#BA7517', 'gemini-flash': '#378ADD'
}

const TEMA_COLORS: Record<string, string> = {
  bug: '#D85A30', feature: '#1D9E75', arquitectura: '#7F77DD',
  planning: '#378ADD', ui: '#BA7517', otro: '#5a5754'
}

function Badge({ tema }: { tema: string }) {
  const color = TEMA_COLORS[tema] || '#5a5754'
  return <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: color + '22', color, border: `0.5px solid ${color}44`, letterSpacing: '0.3px' }}>{tema}</span>
}

function ModelChip({ modelo, skill }: { modelo: string; skill: string }) {
  if (!modelo) return null
  const color = MODEL_COLORS[modelo] || '#5a5754'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#1a1a1a', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 11, color: '#e8e6e1' }}>{modelo}</div>
        {skill && <div style={{ fontSize: 10, color: '#5a5754' }}>skill: {skill}</div>}
      </div>
    </div>
  )
}

function buildContext(s: Signal): string {
  const p = s.parsed
  const lines = [`## Contexto — ${s.proyecto}`]
  if (s.contexto) lines.push(`tarea: ${s.contexto}`)
  if (s.stack?.length) lines.push(`stack: ${s.stack.join(', ')}`)
  if (p.decisiones?.length) { lines.push(''); lines.push('decisiones:'); p.decisiones.forEach((d: string) => lines.push(`  - ${d}`)) }
  if (p.preferencias?.length) { lines.push(''); lines.push('preferencias:'); p.preferencias.forEach((x: string) => lines.push(`  - ${x}`)) }
  if (p.errores_resueltos?.length) { lines.push(''); lines.push('resuelto:'); p.errores_resueltos.forEach((e: string) => lines.push(`  - ${e}`)) }
  if (s.modelo) { lines.push(''); lines.push(`modelo: ${s.modelo}`) }
  if (s.skill) lines.push(`skill: ${s.skill}`)
  return lines.join('\n')
}

export default function Home() {
  const [tab, setTab] = useState<'save' | 'query' | 'library' | 'lexicon'>('save')
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [meta, setMeta] = useState<Meta>({ total: 0, projects: 0, topics: 0, proyectos: [], temas: [], stacks: [] })
  const [signals, setSignals] = useState<Signal[]>([])
  const [lexicon, setLexicon] = useState<LexiconGroup[]>([])
  const [query, setQuery] = useState('')
  const [filterP, setFilterP] = useState('')
  const [filterT, setFilterT] = useState('')
  const [filterS, setFilterS] = useState('')
  const [querying, setQuerying] = useState(false)
  const [synInput, setSynInput] = useState('')
  const [synDomain, setSynDomain] = useState('general')
  const [synLangs, setSynLangs] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadMeta = useCallback(async () => {
    const r = await fetch('/api/meta')
    const d = await r.json()
    setMeta(d)
  }, [])

  const loadLibrary = useCallback(async () => {
    const r = await fetch('/api/signals')
    const d = await r.json()
    setSignals(d.signals || [])
  }, [])

  const loadLexicon = useCallback(async () => {
    const r = await fetch('/api/lexicon')
    const d = await r.json()
    setLexicon(d.lexicon || [])
  }, [])

  useEffect(() => { loadMeta() }, [loadMeta])

  useEffect(() => {
    if (tab === 'library') loadLibrary()
    if (tab === 'lexicon') loadLexicon()
  }, [tab, loadLibrary, loadLexicon])

  const runQuery = useCallback(async () => {
    setQuerying(true)
    const r = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, proyecto: filterP, tema: filterT, stack: filterS })
    })
    const d = await r.json()
    setSignals(d.signals || [])
    setQuerying(false)
  }, [query, filterP, filterT, filterS])

  useEffect(() => {
    if (tab === 'query') runQuery()
  }, [tab, query, filterP, filterT, filterS, runQuery])

  const saveSignal = async () => {
    if (!input.trim()) { showToast('paste a JSON signal first'); return }
    let parsed
    try { parsed = JSON.parse(input) } catch { showToast('invalid JSON — check format'); return }
    if (!parsed.proyecto) { showToast('field "proyecto" is required'); return }
    setSaving(true)
    const r = await fetch('/api/signals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed)
    })
    const d = await r.json()
    setSaving(false)
    if (d.error) { showToast('error: ' + d.error); return }
    setInput('')
    showToast('signal vectorized + saved')
    loadMeta()
  }

  const deleteSignal = async (id: string) => {
    await fetch('/api/signals', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    showToast('signal removed')
    loadMeta()
    if (tab === 'library') loadLibrary()
    if (tab === 'query') runQuery()
  }

  const addSynGroup = async () => {
    const terms = synInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    if (terms.length < 2) { showToast('need at least 2 terms'); return }
    const langs = synLangs.split(',').map(l => l.trim()).filter(Boolean)
    const r = await fetch('/api/lexicon', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terms, domain: synDomain, langs })
    })
    const d = await r.json()
    if (d.error) { showToast(d.error); return }
    setSynInput(''); setSynLangs('')
    loadLexicon()
    showToast('synonym group added')
  }

  const deleteSynGroup = async (id: string) => {
    await fetch('/api/lexicon', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadLexicon()
    showToast('group removed')
  }

  const copy = (text: string, msg = 'copied!') => {
    navigator.clipboard.writeText(text).then(() => showToast(msg)).catch(() => showToast('select and copy manually'))
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <span className={styles.logo}>Alexandria</span>
        <span className={styles.tagline}>context that survives the next chat</span>
        <div className={styles.stats}>
          <span>{meta.total} signals</span>
          <span>{meta.projects} projects</span>
        </div>
      </header>

      <nav className={styles.tabs}>
        {(['save','query','library','lexicon'] as const).map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
            {t === 'save' ? '_ save' : t === 'query' ? '/ query' : t === 'library' ? '@ library' : '~ lexicon'}
          </button>
        ))}
      </nav>

      {tab === 'save' && (
        <div className={styles.panel}>
          <div className={styles.card}>
            <div className={styles.label}>paste your signal json</div>
            <textarea className={styles.textarea} rows={10} value={input} onChange={e => setInput(e.target.value)}
              placeholder={'{\n  "proyecto": "Spybee",\n  "contexto": "refactor de breadcrumbs",\n  "tema": "feature",\n  "stack": ["Next.js", "TypeScript"],\n  "decisiones": ["usar Zustand en lugar de Redux"],\n  "preferencias": ["solo código que cambió"],\n  "errores_resueltos": [],\n  "modelo_sugerido": "claude-sonnet-4-6",\n  "skill_sugerida": "nextjs.md"\n}'} />
            <div className={styles.row} style={{ marginTop: 10, justifyContent: 'flex-end' }}>
              <button className={styles.btn} onClick={() => setInput('')}>clear</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveSignal} disabled={saving}>
                {saving ? 'vectorizing...' : 'vectorize + save →'}
              </button>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.label}>prompt template</div>
            <pre className={styles.codeBlock}>{PROMPT_TEMPLATE}</pre>
            <div className={styles.row} style={{ marginTop: 10, justifyContent: 'flex-end' }}>
              <button className={styles.btn} onClick={() => copy(PROMPT_TEMPLATE, 'prompt copied!')}>copy prompt →</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'query' && (
        <div className={styles.panel}>
          <div className={styles.card}>
            <div className={styles.label}>filters</div>
            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>proyecto</span>
                <select className={styles.select} value={filterP} onChange={e => setFilterP(e.target.value)}>
                  <option value="">todos</option>
                  {meta.proyectos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>tema</span>
                <select className={styles.select} value={filterT} onChange={e => setFilterT(e.target.value)}>
                  <option value="">todos</option>
                  {meta.temas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>stack</span>
                <select className={styles.select} value={filterS} onChange={e => setFilterS(e.target.value)}>
                  <option value="">todos</option>
                  {meta.stacks.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <input className={styles.input} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="busca contexto... ej: terapeuta / therapist / race condition" style={{ marginTop: 10 }} />
            <div style={{ fontSize: 10, color: '#5a5754', marginTop: 6 }}>búsqueda híbrida: texto plano + semántica multilingüe</div>
          </div>

          {querying && <div className={styles.empty}>vectorizando query...</div>}
          {!querying && signals.length === 0 && <div className={styles.empty}>sin resultados.<br />prueba otros filtros o términos.</div>}
          {!querying && signals.map(s => (
            <div key={s.id} className={styles.card}>
              <div className={styles.row} style={{ marginBottom: 6 }}>
                <Badge tema={s.tema} />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#e8e6e1' }}>{s.proyecto}</span>
                {s.contexto && <span style={{ fontSize: 11, color: '#9a9690' }}>— {s.contexto}</span>}
                <span style={{ fontSize: 10, color: '#5a5754', marginLeft: 'auto' }}>{s.fecha}</span>
              </div>
              <ModelChip modelo={s.modelo} skill={s.skill} />
              <pre className={styles.contextBlock}>{buildContext(s)}</pre>
              <div className={styles.row} style={{ marginTop: 8, justifyContent: 'flex-end', gap: 8 }}>
                <button className={styles.btn} style={{ fontSize: 10, padding: '4px 8px', color: '#5a5754' }} onClick={() => deleteSignal(s.id)}>×</button>
                <button className={styles.btn} onClick={() => copy(buildContext(s), 'context copied!')}>copy context →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'library' && (
        <div className={styles.panel}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}><div className={styles.statNum}>{meta.total}</div><div className={styles.statLabel}>signals</div></div>
            <div className={styles.statCard}><div className={styles.statNum}>{meta.projects}</div><div className={styles.statLabel}>projects</div></div>
            <div className={styles.statCard}><div className={styles.statNum}>{meta.topics}</div><div className={styles.statLabel}>topics</div></div>
          </div>

          <div className={styles.card}>
            <div className={styles.label}>routing table</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {[
                { model: 'claude-opus-4-6',   reason: 'arquitectura · decisiones críticas · 2 intentos fallidos' },
                { model: 'claude-sonnet-4-6', reason: 'features · bugs complejos primer intento' },
                { model: 'gemini-flash',      reason: 'boilerplate · ui repetitiva · bugs 2do intento' },
                { model: 'claude-haiku-4-5',  reason: 'microtareas · clasificar · resumir' },
              ].map(({ model, reason }) => (
                <div key={model} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#1a1a1a', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: MODEL_COLORS[model] || '#5a5754', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#e8e6e1' }}>{model}</div>
                    <div style={{ fontSize: 10, color: '#5a5754' }}>{reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.label}>all signals</div>
            {signals.length === 0
              ? <div className={styles.empty}>empty library.<br />save your first signal.</div>
              : signals.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <Badge tema={s.tema} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#e8e6e1' }}>{s.proyecto}</span>
                  {s.contexto && <span style={{ fontSize: 10, color: '#9a9690', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {s.contexto}</span>}
                  {!s.contexto && <span style={{ flex: 1 }} />}
                  <span style={{ fontSize: 10, color: '#5a5754' }}>{s.stack.slice(0,2).join(' · ')}</span>
                  <span style={{ fontSize: 10, color: '#5a5754' }}>{s.fecha}</span>
                  <button className={styles.btn} style={{ fontSize: 10, padding: '3px 7px' }} onClick={() => deleteSignal(s.id)}>×</button>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {tab === 'lexicon' && (
        <div className={styles.panel}>
          <div className={styles.card}>
            <div className={styles.label}>multilingual synonym groups</div>
            <div style={{ fontSize: 10, color: '#5a5754', marginBottom: 12, lineHeight: 1.7 }}>
              Términos en el mismo grupo se tratan como equivalentes al vectorizar y buscar.<br />
              Agrega grupos para tu dominio — en la versión pro, cada usuario configura los suyos.
            </div>
            {lexicon.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: '#5a5754', minWidth: 70 }}>{g.domain}</span>
                <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                  {g.terms.map(t => <span key={t} style={{ fontSize: 10, padding: '2px 8px', background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 20, color: '#9a9690' }}>{t}</span>)}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {g.langs.map(l => <span key={l} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#1a2a3a', color: '#378ADD' }}>{l}</span>)}
                  <button className={styles.btn} style={{ fontSize: 10, padding: '3px 7px' }} onClick={() => deleteSynGroup(g.id)}>×</button>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
              <div className={styles.label}>add synonym group</div>
              <input className={styles.input} value={synInput} onChange={e => setSynInput(e.target.value)}
                placeholder="therapist, terapeuta, terapista, Therapeut" style={{ marginBottom: 8 }} />
              <div className={styles.filterRow}>
                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>domain</span>
                  <select className={styles.select} value={synDomain} onChange={e => setSynDomain(e.target.value)}>
                    {['general','mental-health','dev','spybee','custom'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>languages</span>
                  <input className={styles.input} value={synLangs} onChange={e => setSynLangs(e.target.value)} placeholder="es, en, de, fr" />
                </div>
                <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ alignSelf: 'flex-end' }} onClick={addSynGroup}>add →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
