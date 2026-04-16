import { getDb, persist } from './index'

const DEFAULT_LEXICON = [
  { id: 'lex_1',  terms: ['therapist','terapeuta','terapista','therapeut','thérapeute'],               domain: 'mental-health', langs: ['en','es','de','fr'] },
  { id: 'lex_2',  terms: ['bug','error','fallo','defecto','issue','problema'],                         domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_3',  terms: ['feature','funcionalidad','característica','función'],                       domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_4',  terms: ['dashboard','panel','tablero','vista principal'],                            domain: 'general',       langs: ['en','es'] },
  { id: 'lex_5',  terms: ['viewer','visor','visualizador'],                                            domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_6',  terms: ['breadcrumbs','migas','navegación','nav path'],                              domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_7',  terms: ['patient','paciente','cliente','user','usuario'],                            domain: 'mental-health', langs: ['en','es'] },
  { id: 'lex_8',  terms: ['appointment','cita','consulta','sesión','session'],                         domain: 'mental-health', langs: ['en','es'] },
  { id: 'lex_9',  terms: ['refactor','refactorizar','reestructurar','rewrite','reescribir'],           domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_10', terms: ['authentication','autenticación','auth','login','inicio de sesión'],         domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_11', terms: ['database','base de datos','db','storage','almacenamiento'],                 domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_12', terms: ['component','componente','widget','elemento'],                               domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_13', terms: ['timelapse','lapso de tiempo','time-lapse'],                                 domain: 'spybee',        langs: ['en','es'] },
  { id: 'lex_14', terms: ['point cloud','nube de puntos','pointcloud','potree'],                       domain: 'spybee',        langs: ['en','es'] },
  { id: 'lex_15', terms: ['extension','extensión','plugin','addon','chrome ext'],                      domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_16', terms: ['template','plantilla','boilerplate'],                                       domain: 'general',       langs: ['en','es'] },
  { id: 'lex_17', terms: ['deployment','despliegue','deploy','subir a producción','release'],          domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_18', terms: ['hook','custom hook','composable'],                                          domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_19', terms: ['merge conflict','conflicto de merge','conflicto git'],                      domain: 'dev',           langs: ['en','es'] },
  { id: 'lex_20', terms: ['race condition','condición de carrera','timing issue','async problem'],     domain: 'dev',           langs: ['en','es'] },
]

async function seed() {
  const db = await getDb()
  for (const row of DEFAULT_LEXICON) {
    db.run(
      `INSERT OR IGNORE INTO lexicon (id, terms, domain, langs) VALUES (?, ?, ?, ?)`,
      [row.id, JSON.stringify(row.terms), row.domain, JSON.stringify(row.langs)]
    )
  }
  persist(db)
  console.log(`✅ Seeded ${DEFAULT_LEXICON.length} lexicon groups`)
}

seed()
