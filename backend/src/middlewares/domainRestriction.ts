import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de restrição por domínio
 *
 * Permite configurar domínios dedicados que só podem acessar rotas específicas.
 * Útil para ter um domínio curto de redirect (ex: wpp.link) que não expõe a API.
 *
 * Configuração via variável de ambiente:
 * RESTRICTED_DOMAINS=wpplink.com.br,outrodominio.com
 *
 * Esses domínios SÓ podem acessar:
 * - /l/* (redirect de WhatsApp)
 * - /health (health check)
 */

// Rotas permitidas para domínios restritos
const ALLOWED_PATHS_FOR_RESTRICTED_DOMAINS = [
  '/l/',      // Redirect de WhatsApp links
  '/health',  // Health check
];

// Cache dos domínios restritos (parseado do .env)
let restrictedDomainsCache: string[] | null = null;

function getRestrictedDomains(): string[] {
  if (restrictedDomainsCache === null) {
    const envDomains = process.env.RESTRICTED_DOMAINS || '';
    restrictedDomainsCache = envDomains
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);

    if (restrictedDomainsCache.length > 0) {
      console.log(`[DomainRestriction] Domínios restritos configurados: ${restrictedDomainsCache.join(', ')}`);
    }
  }
  return restrictedDomainsCache;
}

/**
 * Extrai o hostname da requisição
 * Considera headers de proxy reverso (X-Forwarded-Host)
 */
function getRequestHost(req: Request): string {
  // Prioridade: X-Forwarded-Host > Host header
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost
    ? (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)
    : req.headers.host || '';

  // Remove porta se existir (ex: localhost:3030 -> localhost)
  return host.split(':')[0].toLowerCase();
}

/**
 * Verifica se o path é permitido para domínios restritos
 */
function isPathAllowedForRestrictedDomain(path: string): boolean {
  return ALLOWED_PATHS_FOR_RESTRICTED_DOMAINS.some(allowedPath =>
    path.startsWith(allowedPath) || path === allowedPath.replace('/', '')
  );
}

/**
 * Middleware que bloqueia acesso a rotas não permitidas
 * quando acessado de um domínio restrito
 */
export function domainRestriction(req: Request, res: Response, next: NextFunction) {
  const restrictedDomains = getRestrictedDomains();

  // Se não há domínios restritos configurados, permite tudo
  if (restrictedDomains.length === 0) {
    return next();
  }

  const requestHost = getRequestHost(req);
  const isRestrictedDomain = restrictedDomains.includes(requestHost);

  // Se não é um domínio restrito, permite tudo
  if (!isRestrictedDomain) {
    return next();
  }

  // É um domínio restrito - verifica se o path é permitido
  const path = req.path;

  if (isPathAllowedForRestrictedDomain(path)) {
    return next();
  }

  // Domínio restrito tentando acessar rota não permitida
  console.warn(`[DomainRestriction] Blocked: ${requestHost} trying to access ${path}`);

  // Retorna 404 genérico (não revela que a rota existe)
  return res.status(404).send('Not Found');
}

/**
 * Middleware específico para bloquear APENAS a API em domínios restritos
 * Usar em: app.use('/api', blockApiForRestrictedDomains, routes)
 */
export function blockApiForRestrictedDomains(req: Request, res: Response, next: NextFunction) {
  const restrictedDomains = getRestrictedDomains();

  if (restrictedDomains.length === 0) {
    return next();
  }

  const requestHost = getRequestHost(req);
  const isRestrictedDomain = restrictedDomains.includes(requestHost);

  if (isRestrictedDomain) {
    // Domínio restrito tentando acessar API
    console.warn(`[DomainRestriction] API blocked for: ${requestHost}${req.path}`);
    return res.status(404).send('Not Found');
  }

  return next();
}
