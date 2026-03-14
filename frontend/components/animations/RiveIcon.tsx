"use client";

import { memo, useState } from "react";
import { useRive, Layout, Fit, Alignment, UseRiveParameters } from "@rive-app/react-canvas";

export interface RiveIconProps {
  /** Caminho para o arquivo .riv em /public/animations/ */
  src: string;
  /** Nome da State Machine definida no Rive editor */
  stateMachine?: string;
  width?: number;
  height?: number;
  /** Ícone Lucide ou elemento JSX exibido enquanto o .riv carrega */
  fallback?: React.ReactNode;
  className?: string;
  autoplay?: boolean;
}

/**
 * Wrapper reutilizável para animações Rive.
 * Exibe o fallback enquanto o arquivo .riv não está disponível ou carregando.
 *
 * Uso:
 *   <RiveIcon src="/animations/ai-thinking.riv" stateMachine="AI_State" fallback={<Bot />} />
 *
 * Para controlar inputs da State Machine, use useRive() diretamente no componente pai.
 */
export const RiveIcon = memo(function RiveIcon({
  src,
  stateMachine,
  width = 40,
  height = 40,
  fallback,
  className,
  autoplay = true,
}: RiveIconProps) {
  const [loadError, setLoadError] = useState(false);

  const riveParams: UseRiveParameters = {
    src,
    autoplay,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoadError: () => setLoadError(true),
    ...(stateMachine ? { stateMachines: stateMachine } : {}),
  };

  const { RiveComponent, rive } = useRive(riveParams);

  // Mostra fallback se houve erro de carregamento ou .riv não disponível
  if (loadError || !rive) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <div className={className} style={{ width, height, display: "inline-flex" }}>
      <RiveComponent width={width} height={height} />
    </div>
  );
});
