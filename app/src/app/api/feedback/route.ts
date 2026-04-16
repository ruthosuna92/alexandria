import { NextRequest, NextResponse } from 'next/server'
import { recordFeedback, recordMergeFeedback, getLearningStats } from '@/lib/learning'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (body.tipo === 'merge_decision') {
      await recordMergeFeedback(body)
    } else {
      await recordFeedback(body)
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const stats = await getLearningStats()
    return NextResponse.json(stats)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
