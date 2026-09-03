FROM python:3.12-slim

# Keep Python output unbuffered so logs stream straight to `docker-compose`.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# System build deps for psycopg2. libpq is needed at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

RUN chmod +x entrypoint.sh

# Create non-root user (UID 1001; 1000 is often taken by base image)
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["./entrypoint.sh"]
