FROM node:22-alpine

LABEL maintainer="Islamic Open Finance <support@islamicopenfinance.com>"
LABEL description="Mock server for the IOF Platform API"

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy OpenAPI spec from iof-openapi
COPY --from=iof-openapi /spec/openapi.yaml ./spec/

# Copy application code
COPY src/ ./src/

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Environment variables
ENV IOF_MOCK_PORT=8080
ENV IOF_MOCK_MODE=stateless
ENV IOF_MOCK_SEED_DATA=false
ENV IOF_MOCK_LOG_LEVEL=info

# Run server
CMD ["npm", "start"]
