# Production image: one container runs the API and serves the built React app.
# Render builds it from render.yaml on every push to main.

# Stage 1: build the React app into client/dist.
FROM node:22-bookworm-slim AS client-build

WORKDIR /app

# npm ci checks every workspace against the lockfile, so all package.json files are copied.
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace client --workspace shared --include-workspace-root=false

COPY shared shared
COPY client client
RUN npm run build -w client

# Stage 2: the server with runtime dependencies only, plus the built app from stage 1.
FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV CLIENT_DIST_DIR=/app/client/dist
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server --include-workspace-root=false \
  && npm cache clean --force

# Both workspace tsconfig files extend this one, and tsx reads them at runtime.
COPY tsconfig.base.json ./
COPY shared shared
COPY server server
COPY --from=client-build /app/client/dist client/dist

USER node
EXPOSE 3000

# Migrations run on every start. The seed is safe to re-run: it resets the demo users'
# passwords to SEED_PASSWORD, which keeps them in sync with the value set in Render.
CMD ["sh", "-c", "npm run migrate -w server && npm run seed -w server && exec npm start -w server"]
