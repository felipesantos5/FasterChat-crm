# backend/Dockerfile

FROM node:20-alpine

WORKDIR /usr/src/app

# Instala dependências do sistema
RUN apk add --no-cache bash

# Copia arquivos de dependência
COPY package*.json ./
COPY prisma ./prisma/

# --- A CORREÇÃO ESTÁ AQUI ---
# Força a instalação de TODAS as dependências (incluindo tsc-alias e typescript)
# Mesmo que o ambiente esteja setado como production
RUN npm install --include=dev

# Copia o resto do código fonte
COPY . .

# Gera o cliente do Prisma
RUN npx prisma generate

# Compila o TypeScript (agora vai encontrar o tsc e o tsc-alias)
RUN npm run build

# Expõe a porta
EXPOSE 3051

# Comando de start (Lembre-se da dica anterior sobre o package.json)
CMD ["npm", "start"]