import { useState, useEffect, useRef, useCallback } from 'react'

export interface SpellError {
  word: string
  start: number
  end: number
  message: string
  suggestions: string[]
}

const DEBOUNCE_MS = 5000

export function useSpellCheck(text: string) {
  const [errors, setErrors] = useState<SpellError[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCheckedRef = useRef('')

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!text.trim() || text.length < 3) {
      setErrors([])
      lastCheckedRef.current = ''
      return
    }

    if (text === lastCheckedRef.current) return

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/spellcheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const data = await res.json() as { errors: SpellError[] }
        lastCheckedRef.current = text
        setErrors(data.errors)
      } catch {
        setErrors([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [text])

  const clearErrors = useCallback(() => {
    setErrors([])
    lastCheckedRef.current = ''
  }, [])

  return { errors, loading, clearErrors }
}
