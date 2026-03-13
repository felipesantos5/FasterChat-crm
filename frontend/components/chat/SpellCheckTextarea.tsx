'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useSpellCheck, SpellError } from '@/hooks/useSpellCheck'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface SpellCheckTextareaProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  disabled?: boolean
  textareaRef?: React.RefObject<HTMLTextAreaElement>
}

function buildHighlightSegments(text: string, errors: SpellError[]): { text: string; error: SpellError | null }[] {
  if (errors.length === 0) return [{ text, error: null }]

  const sorted = [...errors].sort((a, b) => a.start - b.start)
  const segments: { text: string; error: SpellError | null }[] = []
  let cursor = 0

  for (const err of sorted) {
    if (err.start < cursor) continue
    if (err.start > cursor) {
      segments.push({ text: text.slice(cursor, err.start), error: null })
    }
    segments.push({ text: text.slice(err.start, err.end), error: err })
    cursor = err.end
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), error: null })
  }

  return segments
}

export function SpellCheckTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  textareaRef,
}: SpellCheckTextareaProps) {
  const { errors, loading, clearErrors } = useSpellCheck(value)
  const highlighterRef = useRef<HTMLDivElement>(null)
  const [activeError, setActiveError] = useState<SpellError | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let newValue = e.target.value
      if (newValue.length > 0 && newValue[0] !== newValue[0].toUpperCase()) {
        newValue = newValue[0].toUpperCase() + newValue.slice(1)
        const cursorPos = e.target.selectionStart
        e.target.value = newValue
        e.target.selectionStart = e.target.selectionEnd = cursorPos
      }
      onChange(newValue)
      e.target.style.height = 'auto'
      const newH = Math.min(e.target.scrollHeight, 160)
      e.target.style.height = `${newH}px`
      e.target.style.overflowY = e.target.scrollHeight > 160 ? 'auto' : 'hidden'
    },
    [onChange]
  )

  const syncScroll = useCallback(() => {
    const ta = textareaRef?.current
    const hl = highlighterRef.current
    if (ta && hl) {
      hl.scrollTop = ta.scrollTop
      hl.scrollLeft = ta.scrollLeft
    }
  }, [textareaRef])

  useEffect(() => {
    const ta = textareaRef?.current
    if (!ta) return
    ta.addEventListener('scroll', syncScroll)
    return () => ta.removeEventListener('scroll', syncScroll)
  }, [textareaRef, syncScroll])

  const handleErrorClick = useCallback((err: SpellError, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    setPopoverPos({
      top: e.clientY - rect.top,
      left: e.clientX - rect.left,
    })
    setActiveError(err)
  }, [])

  const applySuggestion = useCallback((suggestion: string) => {
    if (!activeError) return
    const newValue = value.slice(0, activeError.start) + suggestion + value.slice(activeError.end)
    onChange(newValue)
    clearErrors()
    setActiveError(null)
    setPopoverPos(null)
    setTimeout(() => textareaRef?.current?.focus(), 0)
  }, [activeError, value, onChange, clearErrors, textareaRef])

  const segments = buildHighlightSegments(value, errors)

  return (
    <div ref={containerRef} className="relative flex-1 bg-gray-50 dark:bg-gray-800 rounded-2xl">
      {/* Highlighter de fundo */}
      <div
        ref={highlighterRef}
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-sm py-2 px-4 text-transparent"
        style={{ lineHeight: '1.25rem' }}
      >
        {segments.map((seg, i) =>
          seg.error ? (
            <span
              key={i}
              className="border-b-2 border-dotted border-red-500 pointer-events-auto cursor-pointer"
              onClick={(e) => handleErrorClick(seg.error!, e)}
              onContextMenu={(e) => handleErrorClick(seg.error!, e)}
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>

      {/* Textarea transparente por cima */}
      <textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        lang="pt-BR"
        spellCheck={false}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        className="relative z-10 flex-1 w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-transparent resize-none overflow-y-hidden focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 max-h-40 placeholder:text-muted-foreground text-sm py-2 px-4"
        style={{ minHeight: '36px', height: '36px', lineHeight: '1.25rem', caretColor: 'auto' }}
      />

      {/* Indicador de loading */}
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
          <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {/* Popover de sugestões */}
      {activeError && popoverPos && (
        <Popover open onOpenChange={(open) => { if (!open) { setActiveError(null); setPopoverPos(null) } }}>
          <PopoverTrigger asChild>
            <span
              className="absolute z-30 w-0 h-0"
              style={{ top: popoverPos.top, left: popoverPos.left }}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-[280px] p-2 space-y-1.5" side="top" align="start">
            <p className="text-xs text-muted-foreground px-1">{activeError.message}</p>
            {activeError.suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {activeError.suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic px-1">Sem sugestões</p>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
