# ==========================================
# Etapa 1: Construcción (Builder)
# ==========================================
FROM node:24-alpine AS builder
WORKDIR /app

# Dependencias primero para aprovechar la caché de capas de Docker
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ==========================================
# Etapa 2: Ejecución (nginx sin privilegios)
# ==========================================
FROM nginxinc/nginx-unprivileged:1-alpine AS runner

# Dirección del backend dentro de la red de Docker (se puede sobrescribir en el compose)
ENV BACKEND_URL=http://backend:8080

# nginx sustituye ${BACKEND_URL} al arrancar y genera /etc/nginx/conf.d/default.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist/frontend-angular/browser /usr/share/nginx/html

EXPOSE 8080
