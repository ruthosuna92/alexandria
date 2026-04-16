export interface Signal {
  id: string
  proyecto: string
  contexto: string
  tema: string
  stack: string[]
  modelo: string
  skill: string
  encrypted: string
  vector_id: string
  fecha: string
  created_at: number
}

export interface SignalPayload {
  proyecto: string
  contexto?: string
  tema?: string
  stack?: string[]
  decisiones?: string[]
  preferencias?: string[]
  errores_resueltos?: string[]
  modelo_sugerido?: string
  skill_sugerida?: string
}

export interface SignalWithDecrypted extends Signal {
  decrypted: SignalPayload
}

export interface QueryResult {
  signal: SignalWithDecrypted
  score: number
}

export const ROUTING_TABLE = [
  { model: 'claude-opus-4-6',   color: '#7F77DD', reason: 'arquitectura · decisiones críticas · 2 intentos fallidos' },
  { model: 'claude-sonnet-4-6', color: '#1D9E75', reason: 'features · bugs complejos primer intento' },
  { model: 'gemini-2-flash',    color: '#378ADD', reason: 'boilerplate · ui repetitiva · bugs 2do intento' },
  { model: 'claude-haiku-4-5',  color: '#BA7517', reason: 'microtareas · clasificar · resumir' },
]

export const TEMA_COLORS: Record<string, string> = {
  bug:          '#FAECE7',
  feature:      '#E1F5EE',
  arquitectura: '#EEEDFE',
  planning:     '#E6F1FB',
  ui:           '#FAEEDA',
  otro:         '#F1EFE8',
}

export const TEMA_TEXT_COLORS: Record<string, string> = {
  bug:          '#4A1B0C',
  feature:      '#085041',
  arquitectura: '#26215C',
  planning:     '#0C447C',
  ui:           '#633806',
  otro:         '#444441',
}
