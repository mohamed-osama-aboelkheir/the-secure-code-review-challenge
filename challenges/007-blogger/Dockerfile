FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

CMD ["node", "app.js"]
