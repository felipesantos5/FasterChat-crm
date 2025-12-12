# backend/Dockerfile

# Use uma imagem Node.js leve
FROM node:20-alpine

# Cria diretório de trabalho
WORKDIR /usr/src/app

# Instala dependências do sistema necessárias para o Prisma/Bcrypt se necessário
RUN apk add --no-cache openssl

# Copia arquivos de dependência
COPY package*.json ./
COPY prisma ./prisma/

# Instala dependências (npm ci é mais rápido e seguro para CI/CD)
RUN npm ci

# Copia o resto do código fonte
COPY . .

# Gera o cliente do Prisma
RUN npx prisma generate

# Compila o TypeScript para JavaScript
RUN npm run build

# Expõe a porta que sua aplicação usa
EXPOSE 3001

# Comando para iniciar a aplicação em produção
CMD ["npm", "start"]