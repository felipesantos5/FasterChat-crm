'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

// Configuração do NProgress
NProgress.configure({
  showSpinner: false,
  trickleSpeed: 100,
  minimum: 0.3,
});

export function ProgressBarProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Inicia o progress bar quando a rota muda
    NProgress.start();

    // Finaliza o progress bar quando a página carrega
    const handleComplete = () => {
      NProgress.done();
    };

    // Delay mínimo para que o usuário veja o progress bar
    const timer = setTimeout(handleComplete, 100);

    return () => {
      clearTimeout(timer);
      NProgress.done();
    };
  }, [pathname, searchParams]);

  return null;
}
