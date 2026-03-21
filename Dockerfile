# ============================================================
# Dockerfile — finanzapp-mcp (Servidor MCP en TypeScript)
# ============================================================
# Imagen multi-stage:
#   Stage 1 (builder): instala dependencias y compila TypeScript → dist/
#   Stage 2 (runner):  imagen mínima Node.js con sólo el artefacto compilado
# ============================================================

# ---------- Stage 1: build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifests primero para aprovechar la caché de Docker
COPY package*.json ./
COPY tsconfig.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para tsc)
RUN npm ci

# Copiar el código fuente y compilar
COPY src ./src
RUN npm run build

# ---------- Stage 2: runner ----------
FROM node:20-alpine

WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S mcpgroup && \
    adduser  -u 1001 -S mcpuser -G mcpgroup

# Copiar sólo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar artefacto compilado desde el builder
COPY --from=builder /app/dist ./dist

# Cambiar a usuario sin privilegios
USER mcpuser

# Las variables de entorno necesarias se inyectan en tiempo de ejecución.
ENV NODE_ENV=production

# Puerto HTTP para el transporte Streamable HTTP (solo se usa cuando MCP_TRANSPORT=http)
EXPOSE 3001

# Comando de arranque: usa stdio por defecto; si MCP_TRANSPORT=http, usar http-server.js
CMD ["node", "dist/index.js"]

