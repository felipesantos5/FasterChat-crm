# Dockerfile para Railway - Backend CRM AI

# ============================================
# STAGE 1: Builder - Build da aplicação
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências necessárias para Prisma
RUN apk add --no-cache openssl libc6-compat

# Copia arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instala todas as dependências (dev + prod para build)
RUN npm ci

# Gera Prisma Client
RUN npx prisma generate

# Copia código fonte
COPY . .

# Build do TypeScript
RUN npm run build

# ============================================
# STAGE 2: Production - Imagem final
# ============================================
FROM node:20-alpine

WORKDIR /app

# Instala dependências de runtime
RUN apk add --no-cache openssl libc6-compat

# Copia package.json
COPY package*.json ./

# Copia schema e migrations do Prisma
COPY --from=builder /app/prisma ./prisma

# Instala apenas dependências de produção
RUN npm ci --only=production

# Gera Prisma Client na imagem final
RUN npx prisma generate

# Copia código compilado
COPY --from=builder /app/dist ./dist

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3051

# Expõe a porta
EXPOSE 3051

# Inicia a aplicação (já roda prisma migrate deploy automaticamente)
CMD ["npm", "start"]
