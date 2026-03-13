'use client'

import { useCallback } from 'react'

interface SpellCheckTextareaProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  disabled?: boolean
  textareaRef?: React.RefObject<HTMLTextAreaElement>
}

export function SpellCheckTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  textareaRef,
}: SpellCheckTextareaProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
      // Auto-resize
      e.target.style.height = 'auto'
      const newH = Math.min(e.target.scrollHeight, 160)
      e.target.style.height = `${newH}px`
      e.target.style.overflowY = e.target.scrollHeight > 160 ? 'auto' : 'hidden'
    },
    [onChange]
  )

  return (
    <textarea
      ref={textareaRef}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      lang="pt-BR"
      spellCheck={true}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      className="flex-1 rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 resize-none overflow-y-hidden focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 max-h-40 placeholder:text-muted-foreground text-sm py-2 px-4"
      style={{ minHeight: '36px', height: '36px', lineHeight: '1.25rem' }}
    />
  )
}
