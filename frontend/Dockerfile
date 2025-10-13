####################
# BUILD STAGE
####################
FROM node:22.14-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy only the package files first for dependency caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies (for build)
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the Next.js app (including service worker generation)
RUN pnpm run build

####################
# RUNTIME STAGE
####################
FROM node:22.14-alpine AS runner

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Install su-exec for privilege dropping
RUN apk add --no-cache su-exec

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create a non-root user and group (default UID/GID 1001)
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy only the necessary files from the build stage and adjust ownership
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Ensure the /app directory is owned by the default user
#RUN chown -R nextjs:nodejs /app

# Copy the entrypoint script into the container
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Use the entrypoint to optionally override the runtime user
ENTRYPOINT ["/entrypoint.sh"]

# Expose the port the app runs on
EXPOSE 3000

# Start the Next.js app
CMD ["pnpm", "start"]
