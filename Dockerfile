# =============================================================================
# Build Stage
# =============================================================================
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev for building)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:20-alpine AS production

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy Prisma schema and generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || exit 1

# Use dumb-init to handle PID 1 and signal handling properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main"]
