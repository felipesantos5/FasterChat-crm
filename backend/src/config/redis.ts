/**
 * Configuração do Redis para BullMQ
 */

import Redis from 'ioredis';

// Configuração do Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Necessário para BullMQ
  enableReadyCheck: false,
};

// Cria conexão Redis para BullMQ
export const redisConnection = new Redis(redisConfig);

// Log de status
redisConnection.on('connect', () => {
  console.log('✅ Redis connected for BullMQ');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

export default redisConnection;
