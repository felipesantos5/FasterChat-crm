# backend/Dockerfile

# ============================================
# STAGE 1: Builder - Instala dependências e compila
# ============================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Instala dependências do sistema necessárias para o Prisma e build
RUN apk add --no-cache \
    openssl \
    libc6-compat

# Copia arquivos de dependência primeiro (para cache do Docker)
COPY package*.json ./
COPY prisma ./prisma/

# Instala TODAS as dependências (incluindo devDependencies para build)
RUN npm ci

# Gera o cliente do Prisma
RUN npx prisma generate

# Copia o resto do código fonte
COPY . .

# Compila o TypeScript
RUN npm run build

# ============================================
# STAGE 2: Production - Imagem final otimizada
# ============================================
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Instala apenas dependências de runtime necessárias
RUN apk add --no-cache \
    openssl \
    libc6-compat

# Copia package.json e package-lock.json
COPY package*.json ./

# Copia o Prisma schema e migrations primeiro
COPY --from=builder /usr/src/app/prisma ./prisma

# Instala apenas dependências de produção
RUN npm ci --only=production

# Gera o cliente Prisma para a imagem de produção
RUN npx prisma generate

# Copia o código compilado do builder
COPY --from=builder /usr/src/app/dist ./dist

# Define variáveis de ambiente
ENV NODE_ENV=production

# Expõe a porta
EXPOSE 3051

# Healthcheck (opcional mas recomendado)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3051/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Gera o client, aplica as migrações e inicia o servidor
CMD npx prisma generate && npx prisma migrate deploy && npm run start
