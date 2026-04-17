'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import styles from './page.module.css'

type Signal = {
  id: string; proyecto: string; contexto: string; tema: string
  stack: string[]; modelo: string; skill: string; fecha: string
  score?: number
  decisiones?: string[]
  preferencias?: string[]
  errores_resueltos?: string[]
  parsed?: Record<string, any>  // opcional ahora
}
type LexiconGroup = { id: string; terms: string[]; domain: string; langs: string[] }
type Meta = { total: number; projects: number; topics: number; proyectos: string[]; temas: string[]; stacks: string[] }
type MergeCandidate = {
  id: string; proyecto: string; contexto: string; score: number; parsed: any
  decisionsAnalysis: { nueva: string; anterior: string; score: number; tipo: 'duplicado' | 'evolucion' }[]
}
type LearningStats = {
  feedbackCount: number; mergeCount: number; synonymsCount: number
  thresholds: { duplicado: number; evolucion: number }
  routing: Record<string, string>
}

const MODEL_COLORS: Record<string, string> = {
  'claude-sonnet-4-6':'#1D9E75','claude-opus-4-6':'#7F77DD','claude-haiku-4-5':'#BA7517','gemini-flash':'#378ADD'
}
const TEMA_COLORS: Record<string, string> = {
  bug:'#D85A30',feature:'#1D9E75',arquitectura:'#7F77DD',planning:'#378ADD',ui:'#BA7517',otro:'#5a5754'
}

function Badge({ tema }: { tema: string }) {
  const color = TEMA_COLORS[tema] || '#5a5754'
  return <span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:color+'22', color, border:`0.5px solid ${color}44`, letterSpacing:'0.3px' }}>{tema}</span>
}

function ModelChip({ modelo, skill }: { modelo: string; skill: string }) {
  if (!modelo) return null
  const color = MODEL_COLORS[modelo] || '#5a5754'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#1a1a1a', borderRadius:6, border:'0.5px solid rgba(255,255,255,0.08)', marginBottom:8 }}>
      <div style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }} />
      <div>
        <div style={{ fontSize:11, color:'#e8e6e1' }}>{modelo}</div>
        {skill && <div style={{ fontSize:10, color:'#5a5754' }}>skill: {skill}</div>}
      </div>
    </div>
  )
}

function buildContext(s: Signal): string {
  const decisiones = s.decisiones || s.parsed?.decisiones || []
  const preferencias = s.preferencias || s.parsed?.preferencias || []
  const errores = s.errores_resueltos || s.parsed?.errores_resueltos || []
  const lines = [`## Contexto — ${s.proyecto}`]
  if (s.contexto) lines.push(`tarea: ${s.contexto}`)
  if (s.stack?.length) lines.push(`stack: ${s.stack.join(', ')}`)
  if (decisiones.length) { lines.push(''); lines.push('decisiones:'); decisiones.forEach((d: string) => lines.push(`  - ${d}`)) }
  if (preferencias.length) { lines.push(''); lines.push('preferencias:'); preferencias.forEach((x: string) => lines.push(`  - ${x}`)) }
  if (errores.length) { lines.push(''); lines.push('resuelto:'); errores.forEach((e: string) => lines.push(`  - ${e}`)) }
  if (s.modelo) { lines.push(''); lines.push(`modelo: ${s.modelo}`) }
  if (s.skill) lines.push(`skill: ${s.skill}`)
  return lines.join('\n')
}

export default function Home() {
  const [tab, setTab] = useState<'save'|'query'|'library'|'lexicon'|'learning'>('save')
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [meta, setMeta] = useState<Meta>({ total:0, projects:0, topics:0, proyectos:[], temas:[], stacks:[] })
  const [signals, setSignals] = useState<Signal[]>([])
  const [lexicon, setLexicon] = useState<LexiconGroup[]>([])
  const [query, setQuery] = useState('')
  const [queryDisplay, setQueryDisplay] = useState('')
  const [filterP, setFilterP] = useState('')
  const [filterT, setFilterT] = useState('')
  const [filterS, setFilterS] = useState('')
  const [querying, setQuerying] = useState(false)
  const [synInput, setSynInput] = useState('')
  const [synDomain, setSynDomain] = useState('general')
  const [synLangs, setSynLangs] = useState('')
  const [promptTemplate, setPromptTemplate] = useState('cargando prompt...')
  const [mergeCandidate, setMergeCandidate] = useState<MergeCandidate | null>(null)
  const [pendingSignal, setPendingSignal] = useState<any>(null)
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null)
  const debounceRef = useRef<any>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadMeta = useCallback(async () => {
    const r = await fetch('/api/meta'); const d = await r.json(); setMeta(d)
  }, [])

  const loadPrompt = useCallback(async () => {
    const r = await fetch('/api/prompt'); const d = await r.json()
    if (d.prompt) setPromptTemplate(d.prompt)
  }, [])

  const loadLibrary = useCallback(async () => {
    const r = await fetch('/api/signals'); const d = await r.json(); setSignals(d.signals || [])
  }, [])

  const loadLexicon = useCallback(async () => {
    const r = await fetch('/api/lexicon'); const d = await r.json(); setLexicon(d.lexicon || [])
  }, [])

  const loadLearning = useCallback(async () => {
    const r = await fetch('/api/feedback'); const d = await r.json(); setLearningStats(d)
  }, [])

  useEffect(() => { loadMeta(); loadPrompt() }, [loadMeta, loadPrompt])

  useEffect(() => {
    if (tab === 'library') loadLibrary()
    if (tab === 'lexicon') loadLexicon()
    if (tab === 'learning') loadLearning()
  }, [tab, loadLibrary, loadLexicon, loadLearning])

  const runQuery = useCallback(async () => {
    setQuerying(true)
    const r = await fetch('/api/query', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ q:query, proyecto:filterP, tema:filterT, stack:filterS }) })
    const d = await r.json(); setSignals(d.signals || []); setQuerying(false)
  }, [query, filterP, filterT, filterS])

  useEffect(() => { if (tab === 'query') runQuery() }, [tab, query, filterP, filterT, filterS, runQuery])

  const trackFeedback = async (tipo: string, signal: Signal, q?: string) => {
    await fetch('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ tipo, signal_id: signal.id, query: q||query, proyecto: signal.proyecto, tema: signal.tema, modelo: signal.modelo, score_coseno: signal.score||0 })
    })
  }

  const checkMerge = async (parsed: any): Promise<MergeCandidate | null> => {
    const r = await fetch('/api/merge-check', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(parsed) })
    const d = await r.json()
    if (d.exists) return d.match
    return null
  }

  const doSave = async (body: any, mode: 'new' | 'replace' | 'combine', existingId?: string) => {
    setSaving(true)
    if (mode === 'replace' && existingId) {
      await fetch('/api/signals', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: existingId }) })
    }
    if (mode === 'combine' && existingId && mergeCandidate) {
      const existing = mergeCandidate.parsed
      body.decisiones    = [...new Set([...(existing.decisiones||[]), ...(body.decisiones||[])])]
      body.preferencias  = [...new Set([...(existing.preferencias||[]), ...(body.preferencias||[])])]
      body.stack         = [...new Set([...(existing.stack||[]), ...(body.stack||[])])]
      body.errores_resueltos = [...new Set([...(existing.errores_resueltos||[]), ...(body.errores_resueltos||[])])]
      await fetch('/api/signals', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: existingId }) })
    }
    const r = await fetch('/api/signals', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    const d = await r.json()
    setSaving(false)
    if (d.error) { showToast('error: ' + d.error); return }
    setInput(''); setMergeCandidate(null); setPendingSignal(null)
    showToast(mode === 'new' ? 'signal saved as new' : mode === 'replace' ? 'signal replaced' : 'signals combined')
    loadMeta(); loadPrompt()
  }

  const saveSignal = async () => {
    if (!input.trim()) { showToast('paste a JSON signal first'); return }
    let parsed: any
    try { parsed = JSON.parse(input) } catch { showToast('invalid JSON — check format'); return }
    if (!parsed.proyecto) { showToast('field "proyecto" is required'); return }
    setSaving(true)
    const candidate = await checkMerge(parsed)
    setSaving(false)
    if (candidate) { setMergeCandidate(candidate); setPendingSignal(parsed) }
    else { await doSave(parsed, 'new') }
  }

  const recordMergeDecision = async (decision: string, decAnalysis: any) => {
    for (const d of decAnalysis) {
      await fetch('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tipo:'merge_decision', score_coseno: d.score, usuario_dijo: decision === 'combine' ? (d.tipo === 'duplicado' ? 'duplicado' : 'evolucion') : 'distintas', texto_a: d.anterior, texto_b: d.nueva, proyecto: pendingSignal?.proyecto, tema: pendingSignal?.tema })
      })
    }
  }

  const deleteSignal = async (signal: Signal) => {
    await trackFeedback('delete', signal)
    await fetch('/api/signals', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: signal.id }) })
    showToast('signal removed'); loadMeta()
    if (tab === 'library') loadLibrary()
    if (tab === 'query') runQuery()
  }

  const copyContext = async (signal: Signal) => {
    const ctx = buildContext(signal)
    navigator.clipboard.writeText(ctx).then(async () => {
      showToast('context copied!')
      await trackFeedback('copy', signal)
    }).catch(() => showToast('select and copy manually'))
  }

  const addSynGroup = async () => {
    const terms = synInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    if (terms.length < 2) { showToast('need at least 2 terms'); return }
    const langs = synLangs.split(',').map(l => l.trim()).filter(Boolean)
    const r = await fetch('/api/lexicon', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ terms, domain: synDomain, langs }) })
    const d = await r.json()
    if (d.error) { showToast(d.error); return }
    setSynInput(''); setSynLangs(''); loadLexicon(); showToast('synonym group added')
  }

  const deleteSynGroup = async (id: string) => {
    await fetch('/api/lexicon', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    loadLexicon(); showToast('group removed')
  }

  const copy = (text: string, msg = 'copied!') => {
    navigator.clipboard.writeText(text).then(() => showToast(msg)).catch(() => showToast('select and copy manually'))
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <span className={styles.logo}>Alexandria</span>
        <span className={styles.tagline}>context that survives the next chat</span>
        <div className={styles.stats}><span>{meta.total} signals</span><span>{meta.projects} projects</span></div>
      </header>

      <nav className={styles.tabs}>
        {(['save','query','library','lexicon','learning'] as const).map(t => (
          <button key={t} className={`${styles.tab} ${tab===t?styles.tabActive:''}`} onClick={() => setTab(t)}>
            {t==='save'?'_ save':t==='query'?'/ query':t==='library'?'@ library':t==='lexicon'?'~ lexicon':'∞ learning'}
          </button>
        ))}
      </nav>

      {tab === 'save' && (
        <div className={styles.panel}>
          <div className={styles.card}>
            <div className={styles.label}>paste your signal json</div>
            <textarea className={styles.textarea} rows={10} value={input} onChange={e => setInput(e.target.value)}
              placeholder={'{\n  "proyecto": "Spybee",\n  "contexto": "refactor de breadcrumbs",\n  "tema": "feature",\n  "stack": ["Next.js", "TypeScript"],\n  "decisiones": ["usar Zustand en lugar de Redux"],\n  "preferencias": ["solo código que cambió"],\n  "errores_resueltos": [],\n  "modelo_sugerido": "claude-sonnet-4-6",\n  "skill_sugerida": "nextjs.md"\n}'} />
            <div className={styles.row} style={{ marginTop:10, justifyContent:'flex-end' }}>
              <button className={styles.btn} onClick={() => setInput('')}>clear</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveSignal} disabled={saving}>
                {saving ? 'analizando...' : 'vectorize + save →'}
              </button>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.label}>prompt template — dinámico</div>
            <pre className={styles.codeBlock}>{promptTemplate}</pre>
            <div className={styles.row} style={{ marginTop:10, justifyContent:'flex-end' }}>
              <button className={styles.btn} onClick={() => copy(promptTemplate, 'prompt copied!')}>copy prompt →</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'query' && (
        <div className={styles.panel}>
          <div className={styles.card}>
            <div className={styles.label}>filters</div>
            <div className={styles.filterRow}>
              <div className={styles.filterGroup}><span className={styles.filterLabel}>proyecto</span>
                <select className={styles.select} value={filterP} onChange={e => setFilterP(e.target.value)}>
                  <option value="">todos</option>{meta.proyectos.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className={styles.filterGroup}><span className={styles.filterLabel}>tema</span>
                <select className={styles.select} value={filterT} onChange={e => setFilterT(e.target.value)}>
                  <option value="">todos</option>{meta.temas.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.filterGroup}><span className={styles.filterLabel}>stack</span>
                <select className={styles.select} value={filterS} onChange={e => setFilterS(e.target.value)}>
                  <option value="">todos</option>{meta.stacks.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <input className={styles.input} value={queryDisplay} onChange={e => {
              setQueryDisplay(e.target.value)
              if (debounceRef.current) clearTimeout(debounceRef.current)
              debounceRef.current = setTimeout(() => setQuery(e.target.value), 350)
            }} placeholder="busca contexto... ej: terapeuta / therapist / race condition" style={{ marginTop:10 }} />
            <div style={{ fontSize:10, color:'#5a5754', marginTop:6 }}>búsqueda híbrida · semántica multilingüe · ranking aprendido</div>
          </div>
          {querying && <div className={styles.empty}>vectorizando query...</div>}
          {!querying && signals.length===0 && <div className={styles.empty}>sin resultados.<br/>prueba otros filtros o términos.</div>}
          {!querying && signals.map(s => (
            <div key={s.id} className={styles.card}>
              <div className={styles.row} style={{ marginBottom:6 }}>
                <Badge tema={s.tema} />
                <span style={{ fontSize:12, fontWeight:500, color:'#e8e6e1' }}>{s.proyecto}</span>
                {s.contexto && <span style={{ fontSize:11, color:'#9a9690' }}>— {s.contexto}</span>}
                <span style={{ fontSize:10, color:'#5a5754', marginLeft:'auto' }}>{s.fecha}</span>
              </div>
              <ModelChip modelo={s.modelo} skill={s.skill} />
              <pre className={styles.contextBlock}>{buildContext(s)}</pre>
              <div className={styles.row} style={{ marginTop:8, justifyContent:'flex-end', gap:8 }}>
                <button className={styles.btn} style={{ fontSize:10, padding:'4px 8px', color:'#5a5754' }} onClick={() => deleteSignal(s)}>×</button>
                <button className={styles.btn} onClick={() => copyContext(s)}>copy context →</button>
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
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:4 }}>
              {[{model:'claude-opus-4-6',reason:'arquitectura · decisiones críticas · 2 intentos fallidos'},{model:'claude-sonnet-4-6',reason:'features · bugs complejos primer intento'},{model:'gemini-flash',reason:'boilerplate · ui repetitiva · bugs 2do intento'},{model:'claude-haiku-4-5',reason:'microtareas · clasificar · resumir'}].map(({model,reason}) => (
                <div key={model} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#1a1a1a', borderRadius:6, border:'0.5px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:MODEL_COLORS[model]||'#5a5754', flexShrink:0 }} />
                  <div><div style={{ fontSize:11, color:'#e8e6e1' }}>{model}</div><div style={{ fontSize:10, color:'#5a5754' }}>{reason}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.label}>all signals</div>
            {signals.length===0
              ? <div className={styles.empty}>empty library.<br/>save your first signal.</div>
              : signals.map(s => (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'0.5px solid rgba(255,255,255,0.06)' }}>
                  <Badge tema={s.tema} />
                  <span style={{ fontSize:11, fontWeight:500, color:'#e8e6e1' }}>{s.proyecto}</span>
                  {s.contexto && <span style={{ fontSize:10, color:'#9a9690', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>— {s.contexto}</span>}
                  {!s.contexto && <span style={{ flex:1 }}/>}
                  <span style={{ fontSize:10, color:'#5a5754' }}>{s.stack.slice(0,2).join(' · ')}</span>
                  <span style={{ fontSize:10, color:'#5a5754' }}>{s.fecha}</span>
                  <button className={styles.btn} style={{ fontSize:10, padding:'3px 7px' }} onClick={() => deleteSignal(s)}>×</button>
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
            <div style={{ fontSize:10, color:'#5a5754', marginBottom:12, lineHeight:1.7 }}>
              Los marcados con <span style={{ color:'#1D9E75' }}>∞</span> fueron aprendidos automáticamente por Alexandria.
            </div>
            {lexicon.map(g => (
              <div key={g.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'0.5px solid rgba(255,255,255,0.06)', flexWrap:'wrap' }}>
                <span style={{ fontSize:9, color:'#5a5754', minWidth:70 }}>{g.domain}</span>
                <div style={{ display:'flex', gap:4, flex:1, flexWrap:'wrap', alignItems:'center' }}>
                  {(g as any).source === 'behavior' && <span style={{ fontSize:9, color:'#1D9E75' }}>∞</span>}
                  {g.terms.map(t => <span key={t} style={{ fontSize:10, padding:'2px 8px', background:'#1a1a1a', border:'0.5px solid rgba(255,255,255,0.08)', borderRadius:20, color:'#9a9690' }}>{t}</span>)}
                </div>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  {g.langs.map(l => <span key={l} style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'#1a2a3a', color:'#378ADD' }}>{l}</span>)}
                  <button className={styles.btn} style={{ fontSize:10, padding:'3px 7px' }} onClick={() => deleteSynGroup(g.id)}>×</button>
                </div>
              </div>
            ))}
            <div style={{ marginTop:16, paddingTop:12, borderTop:'0.5px solid rgba(255,255,255,0.06)' }}>
              <div className={styles.label}>add synonym group</div>
              <input className={styles.input} value={synInput} onChange={e => setSynInput(e.target.value)} placeholder="therapist, terapeuta, terapista" style={{ marginBottom:8 }} />
              <div className={styles.filterRow}>
                <div className={styles.filterGroup}><span className={styles.filterLabel}>domain</span>
                  <select className={styles.select} value={synDomain} onChange={e => setSynDomain(e.target.value)}>
                    {['general','mental-health','dev','spybee','custom'].map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className={styles.filterGroup}><span className={styles.filterLabel}>languages</span>
                  <input className={styles.input} value={synLangs} onChange={e => setSynLangs(e.target.value)} placeholder="es, en" />
                </div>
                <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ alignSelf:'flex-end' }} onClick={addSynGroup}>add →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'learning' && (
        <div className={styles.panel}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}><div className={styles.statNum}>{learningStats?.feedbackCount||0}</div><div className={styles.statLabel}>interactions</div></div>
            <div className={styles.statCard}><div className={styles.statNum}>{learningStats?.mergeCount||0}</div><div className={styles.statLabel}>merge decisions</div></div>
            <div className={styles.statCard}><div className={styles.statNum}>{learningStats?.synonymsCount||0}</div><div className={styles.statLabel}>learned synonyms</div></div>
          </div>
          <div className={styles.card}>
            <div className={styles.label}>thresholds aprendidos</div>
            <div style={{ fontSize:10, color:'#5a5754', marginBottom:12 }}>Se ajustan automáticamente con tus decisiones de merge. Mínimo 10 ejemplos para activarse.</div>
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ flex:1, background:'#1a1a1a', borderRadius:8, padding:'12px', border:'0.5px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:10, color:'#5a5754', marginBottom:4 }}>duplicado</div>
                <div style={{ fontSize:22, fontWeight:500, color:'#D85A30' }}>{learningStats?.thresholds.duplicado||0.85}</div>
                <div style={{ fontSize:9, color:'#5a5754', marginTop:4 }}>score coseno mínimo para ignorar</div>
              </div>
              <div style={{ flex:1, background:'#1a1a1a', borderRadius:8, padding:'12px', border:'0.5px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:10, color:'#5a5754', marginBottom:4 }}>evolución</div>
                <div style={{ fontSize:22, fontWeight:500, color:'#BA7517' }}>{learningStats?.thresholds.evolucion||0.50}</div>
                <div style={{ fontSize:9, color:'#5a5754', marginTop:4 }}>score mínimo para mostrar como relacionada</div>
              </div>
            </div>
          </div>
          {learningStats?.routing && Object.keys(learningStats.routing).length > 0 && (
            <div className={styles.card}>
              <div className={styles.label}>routing aprendido</div>
              <div style={{ fontSize:10, color:'#5a5754', marginBottom:12 }}>Modelos que más usas por tipo de tarea.</div>
              {Object.entries(learningStats.routing).map(([tema, modelo]) => (
                <div key={tema} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'0.5px solid rgba(255,255,255,0.06)' }}>
                  <Badge tema={tema} />
                  <span style={{ fontSize:11, color:'#e8e6e1', flex:1 }}>{modelo}</span>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:MODEL_COLORS[modelo]||'#5a5754' }} />
                </div>
              ))}
            </div>
          )}
          <div className={styles.card}>
            <div className={styles.label}>cómo funciona</div>
            <div style={{ fontSize:11, color:'#9a9690', lineHeight:2 }}>
              <span style={{ color:'#e8e6e1' }}>copy context</span> → señal positiva, sube el ranking<br/>
              <span style={{ color:'#e8e6e1' }}>× borrar</span> → señal negativa, baja el ranking<br/>
              <span style={{ color:'#e8e6e1' }}>merge decisions</span> → ajusta thresholds de similitud<br/>
              <span style={{ color:'#1D9E75' }}>∞ sinónimos</span> → se detectan y agregan automáticamente<br/>
              <span style={{ color:'#e8e6e1' }}>routing</span> → aprende qué modelo usas para cada tema
            </div>
          </div>
        </div>
      )}

      {mergeCandidate && pendingSignal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'1rem' }}>
          <div style={{ background:'#1a1a1a', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'1.5rem', maxWidth:560, width:'100%', maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ fontSize:10, color:'#c9a84c', letterSpacing:'1px', textTransform:'uppercase', marginBottom:12 }}>signal existente detectado</div>
            <div style={{ fontSize:12, color:'#e8e6e1', marginBottom:4 }}>{mergeCandidate.proyecto} — {mergeCandidate.contexto}</div>
            <div style={{ fontSize:10, color:'#5a5754', marginBottom:16 }}>similitud: {Math.round(mergeCandidate.score * 100)}%</div>

            {mergeCandidate.decisionsAnalysis.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:10, color:'#5a5754', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:8 }}>decisiones relacionadas detectadas</div>
                {mergeCandidate.decisionsAnalysis.map((d, i) => (
                  <div key={i} style={{ background:'#0f0f0f', borderRadius:8, padding:'10px 12px', marginBottom:8, border:'0.5px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize:10, color:'#BA7517', marginBottom:4 }}>{d.tipo} · {Math.round(d.score*100)}%</div>
                    <div style={{ fontSize:10, color:'#9a9690', marginBottom:2 }}>anterior: <span style={{ color:'#e8e6e1' }}>{d.anterior}</span></div>
                    <div style={{ fontSize:10, color:'#9a9690' }}>nueva: <span style={{ color:'#c9a84c' }}>{d.nueva}</span></div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ flex:1 }} onClick={async () => {
                await recordMergeDecision('combine', mergeCandidate.decisionsAnalysis)
                await doSave(pendingSignal, 'combine', mergeCandidate.id)
              }}>combinar</button>
              <button className={styles.btn} style={{ flex:1 }} onClick={async () => {
                await recordMergeDecision('replace', mergeCandidate.decisionsAnalysis)
                await doSave(pendingSignal, 'replace', mergeCandidate.id)
              }}>reemplazar</button>
              <button className={styles.btn} style={{ flex:1 }} onClick={async () => {
                await recordMergeDecision('new', mergeCandidate.decisionsAnalysis)
                await doSave(pendingSignal, 'new')
              }}>crear nuevo</button>
              <button className={styles.btn} style={{ color:'#5a5754', flex:1 }} onClick={() => { setMergeCandidate(null); setPendingSignal(null) }}>cancelar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
