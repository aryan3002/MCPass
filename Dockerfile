FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy the entire mcpaas monorepo
COPY mcpaas/ ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build all workspace packages in dependency order
RUN pnpm --filter @mcpaas/kernel-types build && \
    pnpm --filter @mcpaas/kernel-auth build && \
    pnpm --filter @mcpaas/kernel-datastore build && \
    pnpm --filter @mcpaas/kernel-connectors build && \
    pnpm --filter @mcpaas/kernel-registry build && \
    pnpm --filter @mcpaas/kernel-runtime build && \
    pnpm --filter @mcpaas/kernel-policy build && \
    pnpm --filter @mcpaas/tools-cribliv build && \
    pnpm --filter @mcpaas/mcp-server build

# Expose port
EXPOSE 3000

# Start the MCP server
CMD ["node", "apps/mcp-server/dist/index.js"]
