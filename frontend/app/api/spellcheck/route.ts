import { NextRequest, NextResponse } from 'next/server'

interface WordError {
  word: string
  start: number
  end: number
  suggestions: string[]
}

// Cache the spell checker instance across requests (loaded once per server restart)
let spellCheckerPromise: Promise<{
  correct: (word: string) => boolean
  suggest: (word: string) => string[]
}> | null = null

function loadSpellChecker() {
  if (!spellCheckerPromise) {
    spellCheckerPromise = new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const loadDict = require('dictionary-pt')
      loadDict((err: Error | null, dict: { aff: Buffer; dic: Buffer }) => {
        if (err) {
          spellCheckerPromise = null
          reject(err)
          return
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nspell = require('nspell')
        resolve(nspell(dict))
      })
    })
  }
  return spellCheckerPromise
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { text?: string }
    const text = body.text

    if (!text || typeof text !== 'string' || text.length > 10000) {
      return NextResponse.json({ errors: [] })
    }

    const spell = await loadSpellChecker()

    const errors: WordError[] = []
    // Match Portuguese words including accented characters
    const wordRegex = /[a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ'-]*/g
    let match: RegExpExecArray | null

    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0]
      const start = match.index
      const end = start + word.length

      if (word.length < 3) continue

      if (!spell.correct(word)) {
        const suggestions = spell.suggest(word).slice(0, 6)
        errors.push({ word, start, end, suggestions })
      }
    }

    return NextResponse.json({ errors })
  } catch (error) {
    console.error('Erro no corretor ortográfico:', error)
    return NextResponse.json({ errors: [] })
  }
}
