# B2C Gateway

Express and TypeScript API with MySQL and Redis.

## Run

From the folder containing `docker-compose.yml`:

```bash
docker compose up --build -d
```

This starts the API, MySQL and Redis. Settings are in `docker-compose.yml`.

Check the API:

```bash
curl http://localhost:3000/api/v1/health
```

View logs with `docker compose logs -f web`. Stop with `docker compose down`.

## Flight search

```bash
curl --get 'http://localhost:3000/api/v1/search/flight' \
  --data-urlencode 'origin=DAC' \
  --data-urlencode 'destination=JFK' \
  --data-urlencode 'departureDate=2026-12-25' \
  --data-urlencode 'returnDate=2026-12-28' \
  --data-urlencode 'tripType=roundTrip' \
  --data-urlencode 'adults=2' \
  --data-urlencode 'children=1' \
  --data-urlencode 'infants=1' \
  --data-urlencode 'cabinClass=business'
```

- Use different three-letter airport codes for origin and destination.
- Trip type: `oneWay` or `roundTrip`. Only round trips require `returnDate`; leave it out for one-way trips.
- Adults: 1–7. Children: 0–5. Infants: at most half the adults, rounded down.
- Adults, children and infants together cannot exceed 7. No `pax` field is needed.
- Cabin class: `economy`, `premiumEconomy`, `business` or `first`. Default is `economy`.
- Children and infants default to 0.

## Hotel search

```bash
curl --get 'http://localhost:3000/api/v1/search/hotel' \
  --data-urlencode 'destination=Dhaka' \
  --data-urlencode 'checkIn=2026-12-25' \
  --data-urlencode 'checkOut=2026-12-28' \
  --data-urlencode 'rooms=2' \
  --data-urlencode 'adults=4' \
  --data-urlencode 'children=2' \
  --data-urlencode 'childAges[0]=5' \
  --data-urlencode 'childAges[1]=8'
```

- Destination, check-in, check-out and adult count are required.
- Rooms: 1–6. Default is 1.
- Total adults: 1 to `rooms × 4`. Total children: 0 to `rooms × 2`.
- Child ages must be integers from 0 to 17. Include infants in the child count.
- Children default to 0 and child ages default to an empty array.

Both searches use Joi validation. Use ISO dates such as `2026-12-25`. Valid requests return HTTP 200 with the validated parameters in `response`. Invalid requests return HTTP 400 with validation errors.

Validation rules are in [search.ts](src/web/validation/search.ts).

## Rate limits

Flight and hotel searches can make many provider calls. Rate limiting keeps repeated searches from overloading the service. The same middleware can be added to other APIs.

MySQL stores the settings. Redis stores request counts and expiry times. The middleware checks the limits before calling the route handler. Exceeding any window returns HTTP 429 with code `E_TOO_MANY_REQUEST`.

### Default limits

Flight and hotel search each have these limits:

| Window | Requests | Duration |
| --- | --- | --- |
| `sort` | 2 | 5 seconds |
| `daily` | 200 | 86,400 seconds |
| `weekly` | 1,000 | 604,800 seconds |

Other routes using the middleware default to 120 requests per 60 seconds. Each window starts with the first request and expires after its duration. Daily and weekly windows do not reset at midnight.

### Which setting is used?

1. If `req.user.id` exists, look for a matching `USER` row. Otherwise, look for a matching `IP` row.
2. If no policy matches, check the `DEFAULT` row in MySQL.
3. If no database policy matches, use the route's code default, then the general code default.

Within a database row, the route entry is checked first, then its `default` entry. The selected policy is used as a whole; windows from different policies are not combined.

Counts are separate for each HTTP method and route. Logged-in users are counted by user ID. Other requests are counted by IP address and User-Agent. The search routes are public; a `USER` rule needs authentication middleware to set `req.user.id` first.

### Set limits in MySQL

Use the `access_configurations` table defined in [access-configuration.ts](src/model/access-configuration.ts).

| `targetType` | `targetValue` | Use case |
| --- | --- | --- |
| `USER` | User ID, such as `user-123` | Give one user a different limit |
| `IP` | Client IP address, such as `203.0.113.10` | Set limits for unauthenticated requests from an IP |
| `DEFAULT` | SQL `NULL` | Set shared defaults |

The `rateLimits` column is a JSON array. Route keys include the uppercase HTTP method and lowercase full path, such as `GET:/api/v1/search/flight`. A `default` key applies to other routes using the middleware for that target.

This example allows one user 10 flight searches per 5 seconds, 500 per day and 2,000 per week. Change the sample values before running it in MySQL:

```sql
SET @target_type = 'USER';
SET @target_value = 'user-123';
SET @editor_id = 1;
SET @rate_limits = '[
  {
    "GET:/api/v1/search/flight": {
      "sort": { "limit": 10, "throttlingInSec": 5 },
      "daily": { "limit": 500, "throttlingInSec": 86400 },
      "weekly": { "limit": 2000, "throttlingInSec": 604800 }
    }
  }
]';

INSERT INTO access_configurations
  (targetType, targetValue, rateLimits, createdBy, createdAt, updatedAt)
VALUES
  (@target_type, @target_value, @rate_limits, @editor_id, NOW(), NOW());
```

For an IP rule, change `@target_type` to `'IP'` and `@target_value` to the client IP. For shared defaults, use `'DEFAULT'` and SQL `NULL`. Set `@editor_id` to the ID of the person making the change. Keep one row per target, including one shared `DEFAULT` row.

To update an existing row, set the variables above to the new values and run this instead of the insert:

```sql
UPDATE access_configurations
SET rateLimits = @rate_limits,
    updatedBy = @editor_id,
    updatedAt = NOW()
WHERE targetType = @target_type
  AND targetValue <=> @target_value;
```

`limit` is the allowed request count. `throttlingInSec` is the window duration in seconds. Use positive integers. Keep `sort`; `daily` and `weekly` are optional. Change the route key to configure hotel search or another API.

Database settings are cached in each API process for 300 seconds by default. Changes take effect after the cache expires, or after restarting the API. Existing Redis counts keep running until their windows expire.

Relevant environment variables:

```env
ACCESS_CONFIGURATION_CACHE_TTL_SEC=300
REDIS_HOST=redis
REDIS_PORT=6379
```

`REDIS_HOST=redis` is the Docker Compose service name. Use your Redis host outside Docker. To change the cache duration in Compose, add `ACCESS_CONFIGURATION_CACHE_TTL_SEC` under `web.environment` in `docker-compose.yml` and recreate the web service.

### Add another route

Place the middleware before the handler, as in [the search router](src/web/router/v1/search.ts):

```ts
import { newRateLimit } from "../../middleware/rate-limit";

router.get("/offers", newRateLimit(), (_req, res) => {
    res.json({ message: "Offers endpoint" });
});
```

In the search router, this creates `GET:/api/v1/search/offers`. Add that key to a database policy to give it a different limit. For authenticated routes, put authentication before the rate limiter.

Code defaults are in `defaultRateLimit` in [rate-limit.ts](src/web/middleware/rate-limit.ts). They use the same route keys and window fields as the database JSON. Database changes do not need a rebuild. Code changes do; run `docker compose up --build -d`.

### Check the response

Add `-i` to either search curl above to see the headers:

| Header | Meaning |
| --- | --- |
| `Rate-Limit-Remaining` | Requests left in the reported window |
| `Rate-Limit-Reset` | Seconds until that window resets |
| `Rate-Limit-Window` | `sort`, `daily` or `weekly` |
| `Retry-After` | Seconds to wait after an HTTP 429 response |

With the default limits, send three valid flight searches within five seconds. The first two pass and the third returns HTTP 429, provided the client has no earlier requests in the active windows. All configured windows count each request, including requests blocked by the limiter.
