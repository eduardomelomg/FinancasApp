# ---------- Etapa 1: build do Vite ----------
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependências (usa o lockfile para builds reproduzíveis)
COPY package*.json ./
RUN npm ci

# Variáveis do Supabase precisam existir no BUILD (o Vite embute no bundle).
# No Coolify, marque estas env vars como "Build Variable".
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

COPY . .
RUN npm run build

# ---------- Etapa 2: servir com nginx ----------
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
