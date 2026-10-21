# syntax=docker/dockerfile:1

# ---------- Etapa 1: compilar ----------
# Se compila en amd64 porque Vite/rolldown no tiene binarios para ARM de 32 bits.
FROM --platform=linux/amd64 node:22-bookworm-slim AS builder
WORKDIR /app

# Variables públicas de Supabase que Vite incrusta en el frontend al compilar.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

# Frena el build si faltan las variables, en lugar de generar una imagen que
# falla en el navegador con "Missing Supabase environment variable(s)".
RUN if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then \
      echo ""; \
      echo "ERROR: faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_PUBLISHABLE_KEY."; \
      echo "Cargá \$buildArgs desde el .env (debe dar 6) y pasalo con @buildArgs."; \
      echo ""; \
      exit 1; \
    fi

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Etapa 2: ejecutar ----------
# Esta etapa toma la arquitectura pedida en --platform (linux/arm/v7 para el NAS).
FROM node:22-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Nitro genera un servidor autocontenido en .output (incluye sus dependencias).
COPY --from=builder /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
