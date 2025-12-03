"use client";

import React from "react";

interface MessageTextProps {
  content: string;
  className?: string;
}

/**
 * Componente que renderiza texto de mensagem com formatação estilo WhatsApp
 * Suporta: *negrito*, _itálico_, ~riscado~, ```código```
 *
 * Como no WhatsApp:
 * - *texto* = negrito
 * - _texto_ = itálico
 * - ~texto~ = riscado
 * - ```texto``` = monoespaçado
 */
export function MessageText({ content, className = "" }: MessageTextProps) {
  const parseWhatsAppFormatting = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let keyCounter = 0;

    // Regex para capturar formatações do WhatsApp
    // *bold* | _italic_ | ~strike~ | ```code```
    const formatRegex = /(\*[^*]+\*)|(_[^_]+_)|(~[^~]+~)|(```[^`]+```)/g;
    let match;

    while ((match = formatRegex.exec(text)) !== null) {
      const matchStart = match.index;
      const matchEnd = formatRegex.lastIndex;
      const matchText = match[0];

      // Adiciona texto antes do match
      if (matchStart > currentIndex) {
        parts.push(text.substring(currentIndex, matchStart));
      }

      // Processa o match baseado no formato
      if (matchText.startsWith('*') && matchText.endsWith('*')) {
        // Negrito: *texto*
        const innerText = matchText.slice(1, -1);
        parts.push(
          <strong key={`bold-${keyCounter++}`} className="font-bold">
            {innerText}
          </strong>
        );
      } else if (matchText.startsWith('_') && matchText.endsWith('_')) {
        // Itálico: _texto_
        const innerText = matchText.slice(1, -1);
        parts.push(
          <em key={`italic-${keyCounter++}`} className="italic">
            {innerText}
          </em>
        );
      } else if (matchText.startsWith('~') && matchText.endsWith('~')) {
        // Riscado: ~texto~
        const innerText = matchText.slice(1, -1);
        parts.push(
          <del key={`strike-${keyCounter++}`} className="line-through">
            {innerText}
          </del>
        );
      } else if (matchText.startsWith('```') && matchText.endsWith('```')) {
        // Código: ```texto```
        const innerText = matchText.slice(3, -3);
        parts.push(
          <code
            key={`code-${keyCounter++}`}
            className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-sm font-mono"
          >
            {innerText}
          </code>
        );
      }

      currentIndex = matchEnd;
    }

    // Adiciona texto restante
    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  return (
    <span className={className}>
      {parseWhatsAppFormatting(content)}
    </span>
  );
}
