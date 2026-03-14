"use client";

import { memo } from "react";
import { Bot } from "lucide-react";

interface AiThinkingAnimationProps {
  isTyping?: boolean;
}

/**
 * Animação de "IA Pensando" — neuronal e orgânica.
 *
 * Infraestrutura Rive pronta: ao criar ai-thinking.riv no Rive editor
 * com State Machine "AI_State" e boolean input "isTyping",
 * substitua o CSS fallback pelo <RiveIcon> abaixo (comentado).
 *
 * import { RiveIcon } from "./RiveIcon";
 * <RiveIcon src="/animations/ai-thinking.riv" stateMachine="AI_State" width={32} height={32} />
 */
export const AiThinkingAnimation = memo(function AiThinkingAnimation({
  isTyping = false,
}: AiThinkingAnimationProps) {
  return (
    <div className="flex justify-start px-3 pb-1">
      <div className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700">
        {/* Ícone com pulso de "respiração" */}
        <span className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-5 w-5 rounded-full bg-violet-400 opacity-20 animate-ping" />
          <Bot className="relative h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        </span>

        <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
          {isTyping ? "IA está digitando" : "IA pensando"}
        </span>

        {/* Ondas neurais */}
        <NeuralWaves isTyping={isTyping} />
      </div>
    </div>
  );
});

function NeuralWaves({ isTyping }: { isTyping: boolean }) {
  const bars = isTyping
    ? [0.4, 1, 0.6, 0.9, 0.5]   // digitando — ondas mais altas
    : [0.3, 0.6, 0.4, 0.7, 0.3]; // pensando — ondas suaves

  return (
    <span className="flex items-center gap-[2px]" style={{ height: 16 }}>
      {bars.map((scale, i) => (
        <span
          key={i}
          className="rounded-full bg-violet-500"
          style={{
            width: 2.5,
            height: `${scale * 100}%`,
            animationName: "neuralPulse",
            animationDuration: `${0.8 + i * 0.12}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: `${i * 0.1}s`,
            opacity: 0.5 + scale * 0.5,
          }}
        />
      ))}
      <style>{`
        @keyframes neuralPulse {
          0%   { transform: scaleY(0.3); opacity: 0.4; }
          100% { transform: scaleY(1);   opacity: 1;   }
        }
      `}</style>
    </span>
  );
}
