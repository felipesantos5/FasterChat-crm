import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Connection pool: ajustado para suportar múltiplos serviços concorrentes
// (webhooks, flow scheduler, campaign workers, WebSocket, etc.)
// Configurável via env para ambientes com mais/menos recursos.
const connectionLimit = parseInt(process.env.PRISMA_CONNECTION_LIMIT || '35', 10);
const poolTimeout = parseInt(process.env.PRISMA_POOL_TIMEOUT || '15', 10);

const databaseUrl = process.env.DATABASE_URL || '';
const separator = databaseUrl.includes('?') ? '&' : '?';
const pooledUrl = databaseUrl.includes('connection_limit')
  ? databaseUrl
  : `${databaseUrl}${separator}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
    datasources: {
      db: { url: pooledUrl },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
