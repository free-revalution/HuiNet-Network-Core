# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY package-lock.json* ./

# Install production dependencies only
RUN npm ci --production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose ports
# 3000: HTTP API
# 3001: WebSocket
# 8000: HuiNet P2P
EXPOSE 3000 3001 8000

# Set default environment variables
ENV HUINET_PORT=8000
ENV HUINET_ENABLE_MDNS=true
ENV HUINET_LOG_LEVEL=info
ENV NODE_ENV=production

# Create a non-root user
RUN addgroup -g 1001 -S huinet && \
    adduser -S -D -u 1001 -G huinet huinet

# Switch to non-root user
USER huinet

# Create a simple startup script
RUN echo 'const proxy = new (require("./dist/index.js").HuiNetProxy)();' > /app/start.js && \
    echo 'proxy.start().catch(err => {' >> /app/start.js && \
    echo '  console.error("Failed to start:", err);' >> /app/start.js && \
    echo '  process.exit(1);' >> /app/start.js && \
    echo '});' >> /app/start.js

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { \
    const data = ''; \
    r.on('data', (c) => data += c); \
    r.on('end', () => { \
      if (data.includes('\"ok\"')) process.exit(0); \
      else process.exit(1); \
    }); \
  })"

# Start the proxy server
CMD ["node", "/app/start.js"]
