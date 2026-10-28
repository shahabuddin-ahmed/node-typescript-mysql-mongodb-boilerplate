FROM node:22-alpine AS builder

WORKDIR /home/node/app

# Cache dependency installation until the Yarn manifests change.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV APPLICATION_SERVER_PORT=3000
WORKDIR /home/node/app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive --production=true \
    && yarn cache clean
COPY --from=builder --chown=node:node /home/node/app/dist ./dist

USER node
EXPOSE 3000

# Run the compiled server directly so it receives Docker shutdown signals.
CMD ["node", "dist/server.js"]
