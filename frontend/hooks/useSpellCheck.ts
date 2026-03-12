'use client'

import { useState, useEffect, useRef } from 'react'

export interface SpellError {
  word: string
  start: number
  end: number
  suggestions: string[]
}

export function useSpellCheck(text: string, debounceMs = 700): SpellError[] {
  const [errors, setErrors] = useState<SpellError[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!text || text.trim().length < 3) {
      setErrors([])
      return
    }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/spellcheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        if (res.ok) {
          const data = await res.json() as { errors: SpellError[] }
          setErrors(data.errors || [])
        }
      } catch {
        setErrors([])
      }
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [text, debounceMs])

  return errors
}
