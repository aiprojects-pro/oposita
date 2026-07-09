# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# OpenShift restricted-v2 ejecuta con UID aleatorio. Dejamos /app y /app/data
# escribibles por el grupo raiz para que el PVC funcione sin SCC custom.
RUN mkdir -p /app/data \
  && chgrp -R 0 /app \
  && chmod -R g=u /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/schema" >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
