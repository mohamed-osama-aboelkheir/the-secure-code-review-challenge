# ---- Stage 1: build the React client -------------------------------------
FROM node:24-slim AS web

WORKDIR /web

COPY web/package*.json ./
RUN npm install

COPY web/ ./
RUN npm run build

# ---- Stage 2: the API server that serves the built client ----------------
FROM node:24-slim

WORKDIR /app

# Install dependencies (use npm install when package-lock.json is not present).
# npm itself is only needed for this step, and it bundles its own dependency
# tree, so it is removed afterwards rather than shipped in the runtime image.
COPY package*.json ./
RUN npm install --omit=dev && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Application code
COPY app.js ./
COPY src ./src

# The compiled single-page app, served as static files by Express
COPY --from=web /web/dist ./web/dist

# Per-account storage lives here; docker-compose mounts a volume over it
ENV STORAGE_ROOT=/app/data/files
RUN mkdir -p /app/data/files && chmod 755 /app/data/files

# Create non-root user (UID 1001; 1000 is often taken by base image)
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

CMD ["node", "app.js"]
