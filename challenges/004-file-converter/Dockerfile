FROM node:20-slim

# LaTeX for PDF conversion
RUN apt-get update && \
    apt-get install -y curl texlive-latex-base texlive-latex-recommended texlive-fonts-recommended && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Pandoc from the upstream release rather than the distribution package: the
# distribution build is several major versions behind, and it loads its data
# files from disk, which makes conversions fail under --sandbox.
ARG PANDOC_VERSION=3.10.2
ARG PANDOC_SHA256_AMD64=6c06b69b49ae95087573631a6fcafb233ab7ab51e5cfa73f7539d6c964a2640d
ARG PANDOC_SHA256_ARM64=868c7675806237dd21711e3890e82f2844e011c8f542a1ddc6245df4324dd6b5
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) sha="$PANDOC_SHA256_AMD64" ;; \
      arm64) sha="$PANDOC_SHA256_ARM64" ;; \
      *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/pandoc.deb \
      "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-1-${arch}.deb"; \
    echo "$sha  /tmp/pandoc.deb" | sha256sum -c -; \
    dpkg -i /tmp/pandoc.deb; \
    rm -f /tmp/pandoc.deb; \
    pandoc --version | head -1

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install when package-lock.json is not present)
RUN npm install --omit=dev

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads && \
    chmod 755 uploads

# Create non-root user (UID 1001; 1000 is often taken by base image)
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "app.js"]
