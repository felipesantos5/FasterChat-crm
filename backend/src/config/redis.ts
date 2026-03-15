/**
 * Configuração do Redis para BullMQ
 *
 * BullMQ requer que Queue e Worker usem conexões SEPARADAS.
 * Compartilhar a mesma instância causa problemas com delayed jobs.
 * Por isso criamos uma factory que gera instâncias independentes.
 */

import Redis from 'ioredis';

// Opções base do Redis
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null as null, // Necessário para BullMQ
  enableReadyCheck: false,
};

/**
 * Cria uma nova instância ioredis independente.
 * Cada Queue e Worker deve usar sua própria conexão.
 */
export function createRedisConnection(): Redis {
  return new Redis(redisOptions);
}

// Instância compartilhada para uso direto (FlowEngine get/set, etc.)
// NÃO usar para BullMQ Queue/Worker
export const redisConnection = new Redis(redisOptions);

// Log de status
redisConnection.on('connect', () => {
  console.error('[Redis] Connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

// Exporta a config para compatibilidade, mas prefira createRedisConnection()
export const redisConfig = redisOptions;

export default redisConnection;
