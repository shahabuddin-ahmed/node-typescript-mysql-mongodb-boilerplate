# B2C Gateway

Express and TypeScript API with MySQL and Redis. Rate limiting is applied to the flight and hotel search APIs.

## Running the API

### Docker Compose

Install Docker with Docker Compose. Extract the project ZIP and open a terminal in the folder containing `docker-compose.yml`:

```bash
docker compose up --build -d
```

Docker installs the dependencies and starts the API, MySQL 8.0, and Redis 7.0. Connection settings and local defaults are in `docker-compose.yml`.

Check the API:

```bash
curl -i http://localhost:3000/api/v1/health
curl -i http://localhost:3000/api/v1/search/flight
curl -i http://localhost:3000/api/v1/search/hotel
```

View logs or stop the services:

```bash
docker compose logs -f web
docker compose down
```

## Rate limits

Flight and hotel search each have these limits:

| Window | Limit |
| --- | --- |
| sort | 2 requests per 5 seconds |
| daily | 200 requests per day |
| weekly | 1000 requests per week |

Other routes using the middleware receive the default limit of 120 requests per 60 seconds unless a custom entry is configured.

Responses include `Rate-Limit-Remaining`, `Rate-Limit-Reset` in seconds, and `Rate-Limit-Window`. Exceeding a limit returns HTTP 429. A reset value of zero is valid near expiry. The transaction requires Redis 7 or newer.

The limiter uses `req.user.id` when authentication middleware has populated it. Otherwise, it uses the client IP and User-Agent. The supplied search routes are public and return sample search responses.

## Adding rate limiting to another route

In `src/web/router/v1/search.ts`, add a route before `return router`. Reuse the existing `rateLimit` middleware:

```ts
router.get("/offers", rateLimit, (_req, res) => {
    res.json({ message: "Offers endpoint" });
});
```

This creates `GET /api/v1/search/offers`. For another router module, import `newRateLimit` and place `newRateLimit()` before its request handler.

## Configuring a route's limits

Add the method and full path to `defaultRateLimit` in `src/web/middleware/rate-limit.ts`:

```ts
"GET:/api/v1/search/offers": {
    sort: { limit: 10, throttlingInSec: 60 },
    daily: { limit: 500, throttlingInSec: 86400 },
},
```

These are example values. `limit` sets the request count and `throttlingInSec` sets the duration in seconds. The `sort` window is required; `daily` and `weekly` are optional. HTTP methods have separate counters. Rebuild the application after changing the settings.

`newRateLimit()` takes no arguments; it reads the matching entry or the default configuration.
