import { NextRequest, NextResponse } from 'next/server'
import { getLexicon, addLexiconGroup, deleteLexiconGroup } from '@/lib/lexicon'

export async function GET() {
  try {
    return NextResponse.json({ lexicon: getLexicon() })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { terms, domain, langs } = await req.json()
    if (!terms || terms.length < 2) return NextResponse.json({ error: 'need at least 2 terms' }, { status: 400 })
    const group = addLexiconGroup({ terms, domain: domain || 'general', langs: langs || [] })
    return NextResponse.json({ group })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    deleteLexiconGroup(id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
