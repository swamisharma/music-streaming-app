# Architecture

## Folder Structure

```
music-streaming-app/
├── src/
│   ├── app.ts                    # Configures Express: middleware, route mounting. Does NOT start the server.
│   ├── server.ts                 # Starts the HTTP listener, loads env, handles graceful shutdown. Does NOT define routes.
│   └── routes/
│       ├── index.ts              # Central route registry (aggregates all versioned routers). Currently empty — will grow.
│       └── v1/
│           ├── index.ts          # v1 router — mounts all v1 sub-routes, exposes GET /api/v1 version info.
│           └── health.route.ts   # Health check route for v1. Returns status + version.
├── docs/
│   └── architecture.md           # This file.
├── .env                          # Local environment variables. Never committed.
├── .env.example                  # Template showing required env keys. Committed.
├── tsconfig.json                 # TypeScript compiler configuration.
└── package.json
```

---

## Layer Responsibilities

### Current Layers

| Layer | Files | Owns | Does NOT own |
|---|---|---|---|
| **Server** | `server.ts` | HTTP listener, env loading, graceful shutdown | Route definitions, business logic |
| **App** | `app.ts` | Middleware registration, route mounting, error handling | Starting the server, DB connections |
| **Routes** | `routes/v1/*.route.ts` | URL-to-handler mapping for a specific resource | Business logic, DB queries |

### Planned Layers (not yet built)

| Layer | Files (planned) | Will own |
|---|---|---|
| **Controller** | `controllers/*.controller.ts` | Request/response handling — reads `req`, calls service, sends `res` |
| **Service** | `services/*.service.ts` | Business logic — rules, transformations, orchestration |
| **Model** | `models/*.model.ts` | Database schema and query definitions |
| **Middleware** | `middlewares/*.middleware.ts` | Cross-cutting concerns — auth, validation, logging, rate limiting |
| **Config** | `config/*.ts` | App-wide configuration — DB connection, env validation |

**Rule:** Each layer only talks to the layer directly below it.  
Controller → Service → Model. Never Controller → Model directly.

---

## Request Lifecycle

Trace of `GET /api/v1/health`:

```
1.  Client sends: GET http://localhost:3000/api/v1/health

2.  server.ts — HTTP server receives the request, hands it to the Express app

3.  app.ts — global middleware runs in order:
      a. express.json()          → parses JSON request body into req.body
      b. express.urlencoded()    → parses form-encoded body
      c. helmet()                → sets security-related HTTP headers
      d. cors()                  → adds CORS headers for cross-origin requests

4.  app.ts — route matching begins:
      GET /           → no match
      GET /health     → no match (path is /api/v1/health)
      app.use('/api/v1', v1Router) → MATCH — strips '/api/v1', passes '/health' to v1Router

5.  routes/v1/index.ts — v1Router receives '/health':
      v1Router.use('/health', healthRouter) → MATCH — strips '/health', passes '/' to healthRouter

6.  routes/v1/health.route.ts — healthRouter receives '/':
      router.get('/') → MATCH — handler executes

7.  Handler sends response:
      res.json({ status: 'ok', version: 'v1' })

8.  Response travels back to client.
```

**What happens when no route matches:**

```
→ Falls through to the 404 handler in app.ts
→ res.status(404).json({ message: 'Route not found' })
```

**What happens when a route throws an error:**

```
→ next(err) is called (or Express catches it automatically in async handlers)
→ Falls through to the error handler in app.ts (4-argument middleware)
→ res.status(500).json({ message: 'Internal Server Error' })
```

---

## Naming Conventions

### Files

| Pattern | Used for | Example |
|---|---|---|
| `*.route.ts` | Route definitions for one resource | `health.route.ts`, `songs.route.ts` |
| `*.controller.ts` | Request/response handlers | `songs.controller.ts` |
| `*.service.ts` | Business logic | `songs.service.ts` |
| `*.middleware.ts` | Express middleware functions | `auth.middleware.ts` |
| `*.model.ts` | Database schema/queries | `user.model.ts` |
| `*.config.ts` | Configuration setup | `db.config.ts` |

### Variables and Types

| Convention | Applied to |
|---|---|
| `camelCase` | Local variables, function names, object properties |
| `PascalCase` | Types, interfaces, classes, enums |
| `UPPER_SNAKE_CASE` | Constants, environment variable names (`PORT`, `NODE_ENV`) |

### Routes

| URL Pattern | Purpose |
|---|---|
| `/` | Root — confirms API is running |
| `/health` | Unversioned infra health check (used by load balancers, monitoring) |
| `/api/v1/...` | All client-facing versioned business routes |
| `/api/v2/...` | Future version — runs alongside v1 without breaking existing clients |

### Router Files

Each resource gets its own route file. The v1 `index.ts` is the only place that mounts them — `app.ts` only knows about the version router, not individual resources.

```
app.ts
  └── /api/v1  →  routes/v1/index.ts
                    ├── /health  →  health.route.ts
                    ├── /songs   →  songs.route.ts   (future)
                    ├── /auth    →  auth.route.ts    (future)
                    └── /users   →  users.route.ts   (future)
```

---

## Key Decisions

| Decision | Chosen | Alternative | Reason |
|---|---|---|---|
| **Module system** | CommonJS (`require`) | ESM (`import/export` native) | Simpler for learning; Express ecosystem has better CommonJS support; avoids ESM/CJS interop issues early on |
| **Hot reload** | `tsx watch` | `nodemon` | Single tool — tsx runs TypeScript directly and watches for changes; nodemon needs a separate TS executor |
| **Versioning strategy** | URL path (`/api/v1`) | Header versioning, query param | Most visible and easiest to test; consistent with most public APIs; no client configuration needed |
| **app.ts vs server.ts split** | Two separate files | Single `index.ts` | Separation of concerns — `app.ts` can be imported in tests without starting a real HTTP server |
| **Graceful shutdown** | `SIGINT` handler in `server.ts` | None | Ensures in-flight requests finish before process exits; required for Docker/cloud deployments |
| **Security headers** | `helmet` | Manual header setting | Industry standard; covers ~12 headers (CSP, HSTS, X-Frame-Options, etc.) with one line |
| **Error handler placement** | Last in `app.ts` | Inline in routes | Express requires error handlers (4-arg) to be registered after all routes; central location avoids duplication |

---

## Future Layers — Planned Implementation Order

As features are added, the following layers will be introduced in this order:

1. **Config** — DB connection, env validation with `zod`
2. **Models** — PostgreSQL schemas via an ORM (e.g. Prisma or Drizzle)
3. **Services** — Business logic per feature (auth, songs, playlists)
4. **Controllers** — Thin handlers that delegate to services
5. **Middlewares** — JWT auth guard, request validation, rate limiting
6. **Background Jobs** — Notification queue via BullMQ + Redis
7. **WebSockets** — Jam session via Socket.io

Each new feature (e.g. songs) will result in:
```
routes/v1/songs.route.ts
controllers/songs.controller.ts
services/songs.service.ts
models/song.model.ts
```
