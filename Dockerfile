# ScenTop: the website, the API and the database migrations in one small image.
# Build:  docker build -t scentop .
# Run:    docker run -p 3000:3000 -e DATABASE_URL=... -e JWT_SECRET=... scentop

# ---- 1. Build the Angular app and compile the server ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:all

# ---- 2. The image that actually runs ----
FROM node:24-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app

# Only the packages the server needs (Angular and Ionic are already bundled into www/)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/www ./www
COPY --from=build /app/dist-server ./dist-server

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "dist-server/index.js"]
