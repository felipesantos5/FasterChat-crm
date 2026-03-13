import { NextRequest, NextResponse } from 'next/server'

interface LanguageToolMatch {
  offset: number
  length: number
  message: string
  replacements: { value: string }[]
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { text?: string }
    const text = body.text

    if (!text || typeof text !== 'string' || text.length > 10000) {
      return NextResponse.json({ errors: [] })
    }

    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        text,
        language: 'pt-BR',
        disabledRules: 'WHITESPACE_RULE',
      }),
    })

    if (!response.ok) {
      console.error(`[SpellCheck] LanguageTool retornou status ${response.status}`)
      return NextResponse.json({ errors: [] })
    }

    const data = (await response.json()) as LanguageToolResponse

    const errors = data.matches.map((match) => ({
      word: text.substring(match.offset, match.offset + match.length),
      start: match.offset,
      end: match.offset + match.length,
      message: match.message,
      suggestions: match.replacements.slice(0, 6).map((r) => r.value),
    }))

    return NextResponse.json({ errors })
  } catch (error) {
    console.error('Erro no corretor ortográfico:', error)
    return NextResponse.json({ errors: [] })
  }
}
