'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useSpellCheck, SpellError } from '@/hooks/useSpellCheck'

interface SpellCheckTextareaProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  disabled?: boolean
  textareaRef?: React.RefObject<HTMLTextAreaElement>
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildHighlightHtml(text: string, errors: SpellError[]): string {
  if (!errors.length) {
    // trailing non-breaking space forces the overlay to have the same height as the textarea
    return escapeHtml(text).replace(/\n/g, '<br>') + '&nbsp;'
  }

  const sorted = [...errors].sort((a, b) => a.start - b.start)
  let result = ''
  let last = 0

  for (const err of sorted) {
    if (err.start < last) continue
    result += escapeHtml(text.slice(last, err.start)).replace(/\n/g, '<br>')
    result +=
      `<span style="color:rgb(239,68,68);text-decoration:underline wavy rgb(239,68,68)">` +
      escapeHtml(err.word) +
      `</span>`
    last = err.end
  }

  result += escapeHtml(text.slice(last)).replace(/\n/g, '<br>') + '&nbsp;'
  return result
}

export function SpellCheckTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  textareaRef: externalRef,
}: SpellCheckTextareaProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = (externalRef ?? internalRef) as React.RefObject<HTMLTextAreaElement>
  const overlayRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const errors = useSpellCheck(value)

  const [popover, setPopover] = useState<{
    open: boolean
    error: SpellError | null
  }>({ open: false, error: null })

  // Sync overlay scroll when textarea scrolls
  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [textareaRef])

  // Detect which word the cursor is on and show suggestions
  const handleClick = useCallback(() => {
    const ta = textareaRef.current
    if (!ta || !errors.length) {
      setPopover({ open: false, error: null })
      return
    }

    const pos = ta.selectionStart
    const hit = errors.find((e) => pos >= e.start && pos <= e.end)

    if (hit && hit.suggestions.length > 0) {
      setPopover({ open: true, error: hit })
    } else {
      setPopover({ open: false, error: null })
    }
  }, [errors, textareaRef])

  // Apply selected suggestion
  const applySuggestion = useCallback(
    (word: string) => {
      const err = popover.error
      if (!err) return

      const newValue = value.slice(0, err.start) + word + value.slice(err.end)
      onChange(newValue)
      setPopover({ open: false, error: null })

      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        const cursor = err.start + word.length
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = cursor
        })
      }
    },
    [popover.error, value, onChange, textareaRef]
  )

  // Close popover when clicking outside
  useEffect(() => {
    if (!popover.open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopover({ open: false, error: null })
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popover.open])

  const highlightHtml = buildHighlightHtml(value, errors)

  // Shared styles so overlay and textarea render text identically
  const sharedStyle: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: '0.875rem',   // text-sm
    lineHeight: '1.25rem',  // leading-5
    letterSpacing: 'inherit',
    padding: '0.5rem 1rem', // py-2 px-4
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus-within:ring-1 focus-within:ring-ring disabled:opacity-50 overflow-hidden"
      style={{ minHeight: '36px' }}
    >
      {/* Highlight overlay — sits behind the transparent textarea */}
      <div
        ref={overlayRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          ...sharedStyle,
          color: 'var(--foreground)',
          maxHeight: '160px',
        }}
        dangerouslySetInnerHTML={{ __html: highlightHtml }}
      />

      {/* Actual textarea — transparent text so only the overlay is visible */}
      <textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="relative w-full bg-transparent resize-none overflow-y-hidden focus:outline-none disabled:opacity-50 max-h-40 placeholder:text-muted-foreground"
        style={{
          ...sharedStyle,
          color: 'transparent',
          caretColor: 'hsl(var(--foreground))',
          height: '36px',
          zIndex: 1,
        }}
        onChange={(e) => {
          onChange(e.target.value)
          e.target.style.height = 'auto'
          const newH = Math.min(e.target.scrollHeight, 160)
          e.target.style.height = `${newH}px`
          e.target.style.overflowY = e.target.scrollHeight > 160 ? 'auto' : 'hidden'
        }}
        onKeyDown={onKeyDown}
        onClick={handleClick}
        onScroll={syncScroll}
      />

      {/* Suggestions popover — appears above the input */}
      {popover.open && popover.error && popover.error.suggestions.length > 0 && (
        <div className="absolute bottom-full left-2 mb-1 z-50 min-w-36 rounded-lg border border-border bg-popover text-popover-foreground shadow-md overflow-hidden">
          <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground font-medium border-b border-border">
            Sugestões para &ldquo;{popover.error.word}&rdquo;
          </p>
          {popover.error.suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault() // prevent textarea blur before click registers
                applySuggestion(s)
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
