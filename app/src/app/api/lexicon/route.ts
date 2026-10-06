import { NextRequest, NextResponse } from 'next/server'
import { getLexicon, addLexiconGroup, deleteLexiconGroup, upsertLexiconGroups } from '@/lib/lexicon'

export async function GET() {
  try { return NextResponse.json({ lexicon: await getLexicon() }) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Bulk import of AI-proposed families (lexicon prompt output).
    if (Array.isArray(body.groups)) {
      return NextResponse.json({ result: await upsertLexiconGroups(body.groups) })
    }

    const { terms, domain, langs } = body
    if (!terms || terms.length < 2) return NextResponse.json({ error: 'need at least 2 terms' }, { status: 400 })
    const group = await addLexiconGroup({ terms, domain: domain || 'general', langs: langs || [] })
    return NextResponse.json({ group })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await deleteLexiconGroup(id)
    return NextResponse.json({ ok: true })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
