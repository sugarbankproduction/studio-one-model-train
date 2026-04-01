// app/api/parse-xml/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { parseFcpXml } from '@/lib/fcp-xml'

export async function POST(req: NextRequest) {
  try {
    const { xmlContent } = await req.json()
    if (!xmlContent || typeof xmlContent !== 'string') {
      return NextResponse.json({ error: 'xmlContent is required' }, { status: 400 })
    }
    const sources = parseFcpXml(xmlContent)
    return NextResponse.json({ sources })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
