FROM node:20-slim

# Install pandoc and basic LaTeX for PDF conversion
RUN apt-get update && \
    apt-get install -y pandoc texlive-latex-base texlive-latex-recommended texlive-fonts-recommended && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

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
