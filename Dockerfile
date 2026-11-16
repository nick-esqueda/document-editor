# Production API image. docker-compose.prod.yml builds it on the EC2 instance,
# so it is always built for the instance's own CPU (ARM on t4g).
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# npm ci checks every workspace against the lockfile, so all package.json files are copied,
# but only the server's runtime dependencies are installed.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server --include-workspace-root=false \
  && npm cache clean --force

COPY shared shared
COPY server server

USER node
EXPOSE 3000

# Migrations run on every start. The seed is safe to re-run: it resets the demo users'
# passwords to SEED_PASSWORD, which keeps them in sync with Parameter Store.
CMD ["sh", "-c", "npm run migrate -w server && npm run seed -w server && exec npm start -w server"]
