/**
 * Configuração do Redis para BullMQ
 *
 * BullMQ recomenda NÃO compartilhar a mesma instância ioredis entre
 * Queue e Worker. Por isso exportamos tanto uma instância padrão
 * quanto um objeto de configuração que o BullMQ usa para criar
 * conexões independentes internamente.
 */

import Redis from 'ioredis';

// Configuração do Redis (objeto plano — BullMQ cria conexões a partir dele)
export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null as null, // Necessário para BullMQ
  enableReadyCheck: false,
};

// Instância compartilhada para uso direto (ex: FlowEngine get/set)
export const redisConnection = new Redis(redisConfig);

// Log de status
redisConnection.on('connect', () => {
  console.error('[Redis] Connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

export default redisConnection;
