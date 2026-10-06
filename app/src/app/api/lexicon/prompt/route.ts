import { NextResponse } from 'next/server'
import { formatLexiconForPrompt, getLexicon, LEXICON_RULES } from '@/lib/lexicon'

// Reads live data; without this Next.js prerenders it once at build time.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const lexicon = await getLexicon()
    const prompt = `Revisa esta conversación y propone familias de palabras para el lexicon de Alexandria (se usa para que las búsquedas encuentren sinónimos, traducciones y alias).

Si tienes las herramientas de Alexandria (MCP): llama alexandria_lexicon_list para ver el lexicon actualizado y guarda con alexandria_lexicon_save.
Si no las tienes: responde solo con este JSON, sin texto adicional ni backticks:
{ "groups": [{ "terms": ["término", "sinónimo", "translation"], "domain": "general", "langs": ["es", "en"] }] }

${LEXICON_RULES}

Lexicon actual:
${formatLexiconForPrompt(lexicon)}`
    return NextResponse.json({ prompt })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
