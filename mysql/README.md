# MySQL Backend API

## Description

Redis connection settings are available as `config.REDIS_HOST` (default
`0.0.0.0`) and `config.REDIS_PORT` (default `6379`). Override them through
the `REDIS_HOST` and `REDIS_PORT` environment variables.

For local development with `yarn dev`, supply a running MySQL server and
Redis instance and export the connection settings in your shell. Yarn does not
automatically load `.env`. To run the complete stack with Docker instead,
follow the instructions below.

The server waits for MySQL, Redis, and route initialization before listening.
Startup fails if Redis cannot connect after bounded retries. SIGINT and SIGTERM
close both database clients, with a shutdown deadline in seconds configured by
`APP_FORCE_SHUTDOWN_SECOND`.

Use `await newRedisClient()` from `src/infra/redis.ts` to get the shared,
connected Redis client. Concurrent calls share the same connection attempt.

Post creation (`POST /api/v1/posts`), updates (`PUT /api/v1/posts/:id`), and
deletion (`DELETE /api/v1/posts/:id`) require an API key. Set `ADMIN_API_KEY`
in the server environment before starting, for example:

```bash
ADMIN_API_KEY=local-development-key yarn dev
```

Send the key in the `accesstoken` header or the `API_KEY` query parameter.
Missing or invalid keys return HTTP 401; writes are also denied if the server
key is unset. Reading posts remains public.

After authentication, middleware attaches
`req.user = { id: "dummy-admin", role: "admin" }`. This identity is shared by
all API key callers until real user authentication is implemented. Future rate
limit middleware can run after `verifyAdmin` and use `req.user.id`.

## Installation with Docker

Install Docker with Docker Compose, clone this repository, and open the `mysql`
directory. No local Node.js, Yarn install, or `.env` file is required:

```bash
docker compose up --build
```

This builds the TypeScript application using Yarn and starts the API, MySQL 8.0,
and Redis 7.0. The app waits for both dependencies to become healthy. Check it at
<http://localhost:3000/api/v1/health>. Use `docker compose up --build -d` to run
in the background and `docker compose logs -f web` to follow application logs.

All required environment settings and local defaults are defined in
`docker-compose.yml`. Inside Docker, the app connects to `db:3306` and
`redis:6379`. MySQL and Redis are accessible within the Compose network;
their ports are not published on the host.

These settings can be overridden from your shell or a local `.env` file:

| Variable | Default | Purpose |
| --- | --- | --- |
| `APPLICATION_SERVER_PORT` | `3000` | Host API port; the container listens on 3000 |
| `ADMIN_API_KEY` | `local-development-key` | Key for authenticated write requests |
| `MYSQL_DATABASE` | `sample_app` | Application database |
| `MYSQL_USER` | `app` | Application database user (must not be `root`) |
| `MYSQL_PASSWORD` | `local-app-password` | Application database password |
| `MYSQL_ROOT_PASSWORD` | `local-root-password` | MySQL root password |
| `PHPMYADMIN_PORT` | `8080` | Optional phpMyAdmin host port |

For example:

```bash
APPLICATION_SERVER_PORT=3001 ADMIN_API_KEY=my-shared-key docker compose up --build
```

Use the API key in the `accesstoken` header for post creation, updates, and
deletion. Replace the example key and database passwords before sharing a
deployment. Existing `.env` values for the variables above override the defaults;
`MYSQL_HOST`, `MYSQL_PORT`, and Redis settings are set explicitly in Compose
so local Yarn connection settings do not affect container networking.

Optional phpMyAdmin is available at <http://localhost:8080> when started with:

```bash
docker compose --profile tools up -d
```

Log in using the configured MySQL user and password. MySQL and Redis data persist
in named volumes across container restarts and `docker compose down`. MySQL
initialization settings apply when its data volume is first created; changing
the credentials later also requires updating the existing database user.

```bash
docker compose down
```

To intentionally delete all Compose database and Redis data and start fresh:

```bash
docker compose down --volumes
```

For local tests, install dependencies with `yarn install --frozen-lockfile`, then
run `yarn test`, `yarn test-unit`, or `yarn test-integ`.
