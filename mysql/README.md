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
- Return dates must be on or after departure. A same-day return is allowed.

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
- Check-out must be after check-in.
- Supply one age (0–17) per child. Include infants in the child count.
- Children default to 0. With no children, child ages default to an empty array.

Use ISO dates such as `2026-12-25`. Valid requests return HTTP 200 with the validated parameters in `response`. Invalid requests, including extra query fields, return HTTP 400 with validation errors.

## Rate limits

The API limits repeated searches to keep the service available. The frontend should use the response headers to show how long the user needs to wait and prevent repeated submissions during that time.

### Limits

Flight and hotel search each use these defaults:

| Window | Requests | Duration |
| --- | --- | --- |
| `sort` | 2 | 5 seconds |
| `daily` | 200 | 24 hours |
| `weekly` | 1,000 | 7 days |

All configured windows apply. Exceeding any one of them returns HTTP 429. Daily and weekly windows start with the first request, rather than resetting at midnight.

Counts are separate for each HTTP method and endpoint. Flight searches do not use the hotel search quota. Requests are counted by account when the API has an authenticated user, otherwise by IP address and User-Agent. The supplied search endpoints are public.

Limits can differ by account or IP and can be changed by the service administrator. Use the response headers for the current limit state instead of hardcoding the default values in the frontend. Other rate-limited endpoints default to 120 requests per minute.

### Response headers

Add `-i` to the curl examples above to see the headers.

| Header | Meaning |
| --- | --- |
| `Rate-Limit-Remaining` | Requests left in the reported window |
| `Rate-Limit-Reset` | Seconds until that window resets; this is a duration, not a timestamp |
| `Rate-Limit-Window` | The reported window: `sort`, `daily` or `weekly` |
| `Retry-After` | Seconds to wait before trying again; included on HTTP 429 |

The headers describe one window at a time. Other windows still apply even if the reported window has requests remaining.

### When a search is blocked

Example response:

```http
HTTP/1.1 429 Too Many Requests
Rate-Limit-Remaining: 0
Rate-Limit-Reset: 4
Rate-Limit-Window: sort
Retry-After: 4
Content-Type: application/json
```

```json
{
  "code": "E_TOO_MANY_REQUEST",
  "message": "You are exceeded the rate limit. Please try after a moment.",
  "response": null,
  "errors": ["You are exceeded the rate limit. Please try after a moment."]
}
```

On the frontend:

1. Check for HTTP 429.
2. Read `Retry-After` and show a message such as “Too many searches. Try again in 4 seconds.”
3. Disable the affected search button for that duration. For a daily or weekly limit, show the longer wait clearly.
4. Allow the user to search again when the countdown finishes. Avoid automatic retry loops; blocked requests also count toward the quotas.

Disable duplicate submissions while a search is running. A countdown is a UI hint; the next API response determines whether another request is allowed.

### Frontend example

This example returns the wait time to the UI when flight search is limited. Use the same response handling for hotel search.

```js
async function searchFlights(params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`/api/v1/search/flight?${query}`);
  const body = await response.json();

  if (response.status === 429) {
    const seconds = response.headers.get("Retry-After")
      ?? response.headers.get("Rate-Limit-Reset")
      ?? "5";

    return {
      status: "limited",
      retryAfter: Math.max(1, Number(seconds)),
      window: response.headers.get("Rate-Limit-Window"),
      message: body.message,
    };
  }

  if (response.status === 400) {
    return { status: "invalid", message: body.message, errors: body.errors };
  }

  if (!response.ok) {
    throw new Error(body.message || "Search failed");
  }

  return { status: "success", data: body.response };
}
```

When `status` is `limited`, use `retryAfter` for the countdown. When it is `invalid`, show `errors` so the user can correct the search.

The example uses a same-origin API path. If the frontend calls the API from a different origin, configure the API or proxy to allow that origin and expose `Rate-Limit-Remaining`, `Rate-Limit-Reset`, `Rate-Limit-Window` and `Retry-After` to browser JavaScript.
