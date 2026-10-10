# Moovex (SendFlow) — imagen de la aplicación Next.js 14
# Copiar a la raíz del repo sendflow. NO PROBADO aún: validar con `docker compose build`.
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `build` ya ejecuta `prisma generate && next build`
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
USER node
CMD ["npm", "run", "start"]
