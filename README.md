# BankHilke

Family allowance banking: parents act as "the bank" for their children over
a double-entry ledger. Backend is a Django REST API (`backend/`); frontend
is a React + TypeScript + Tailwind SPA (`frontend/`). See `AGENTS.md` for
architecture details and `frontend/README.md` for frontend-specific notes.

## Prerequisites

- Docker + Docker Compose (backend stack: Postgres 17, Redis 8, Celery
  worker/beat)
- [Bun](https://bun.sh) (frontend package manager/runner) — `npm`/`node`
  work too if you swap `bun` for `npm` in the commands below
- Python 3.13, only needed if you want to run the backend outside Docker

## Testing

### Backend

The full stack (backend, Postgres, Redis, celery-worker, celery-beat) runs
via the Makefile:

```sh
make run-backend
docker compose -f docker-compose.backend-test.yml exec backend python manage.py test
```

34 tests across the four apps (`users`, `accounts`, `transactions`,
`allowances`) — double-entry ledger correctness, insufficient-funds
rejection, idempotent/catch-up scheduling, and permission boundaries (see
`AGENTS.md` → Testing & QA for the breakdown). Tear down with
`make stop-backend`.

There's no seed data on a fresh database, so create the first login with
`backend/scripts/create_initial_parent.sh` (wraps `manage.py create_parent`
— see below).

Outside Docker: `cd backend && pip install -r requirements.txt && python
manage.py test` (needs a reachable Postgres + `backend/.env` configured, or
point `DATABASES` at SQLite for a quick local run).

### Frontend

There is no automated frontend test suite (no Jest/Vitest configured).
"Testing" the frontend means: static verification, then a manual smoke test
against a running backend.

```sh
cd frontend
bun install
bun run build   # tsc -b (type-check) && vite build — fails on type errors
bun run lint    # oxlint
```

Manual smoke test (with the backend running per above):

```sh
bun run dev     # http://localhost:5173, proxies /api -> http://localhost:8000
                # (override with BACKEND_PORT=<port>, see below, in frontend/.env.local)
```

Log in as a parent and a child account and exercise: balance/history/
upcoming-events on the child dashboard, and deposit/withdraw + allowance/
interest rule edits + guardian reconciliation on the parent dashboard.
`bun run preview` serves the production `dist/` build the same way, if you
want to smoke-test the actual build artifact rather than the dev server.

## Deploying

```sh
docker compose up -d --build
```

That's the whole thing. It builds and starts everything — Postgres, Redis,
the Django API behind gunicorn, the Celery worker + beat, and the React
frontend behind nginx — and serves the app at **http://localhost/**
(override the published port with `HTTP_PORT=8080 docker compose up -d
--build`, and the backend's own published port -- if something else already
holds 8000 -- with `BACKEND_PORT=8001 docker compose up -d --build`;
`docker-compose.backend-test.yml` honors the same `BACKEND_PORT` for local
dev).

What that one command does, concretely:

- `postgres` and `redis` each have a healthcheck; `backend`, `celery-worker`,
  and `celery-beat` wait for both to report healthy before starting (so the
  first boot doesn't race the database).
- `backend` runs `manage.py migrate`, then `collectstatic` (served by
  WhiteNoise from inside the gunicorn process — no separate static-file
  server needed), then starts `gunicorn`. It also gets its own healthcheck,
  which `frontend` waits on.
- `frontend` is a multi-stage build: `bun run build` produces the static
  `dist/`, then an nginx stage serves it and reverse-proxies `/api/`,
  `/admin/`, and `/static/` to the `backend` service. Frontend and backend
  end up same-origin from the browser's perspective, so there's no CORS
  configuration or build-time `VITE_API_BASE_URL` to set.
- Config (`SECRET_KEY`, `POSTGRES_*`, `ALLOWED_HOSTS`, `CORS_ALLOW_ALL_ORIGINS`)
  comes from `backend/.env`, shared with the dev/test stack; `DEBUG` is
  forced to `False` for this stack specifically via `docker-compose.yml`'s
  `environment:` block, regardless of what `backend/.env` has it set to.
- `postgres_data` is a named volume, so data survives `docker compose down`
  / `up` cycles (use `docker compose down -v` to actually wipe it).

This is `docker-compose.yml` at the repo root — distinct from
`docker-compose.backend-test.yml`, which is the dev-mode stack (Django's
`runserver` with live code reload via a bind mount, backend-only, driven by
`make run-backend`/`make stop-backend`). Both compose files pin distinct
Compose project names (`hilkebank-deploy` / `hilkebank-dev`), so bringing
one up never disturbs containers/volumes belonging to the other — they can
still collide on published host ports (8000, 5432) if run at the same time,
so don't do that -- or set `BACKEND_PORT` to different values for each stack.

### First login: create the initial parent

A fresh database has no users, and children can't self-register (only a
parent can create them, becoming their guardian) — so there's a
chicken-and-egg problem on first boot. `backend/scripts/create_initial_parent.sh`
(a thin wrapper around the `create_parent` management command) breaks it:

```sh
docker compose exec backend ./scripts/create_initial_parent.sh
# dev stack instead: make create-parent
```

Prompts for a username/password if not already set via
`INITIAL_PARENT_USERNAME`/`INITIAL_PARENT_PASSWORD` (see `backend/.env` for
the full list of `INITIAL_PARENT_*` vars, incl. `--superuser` for Django
admin access). Safe to re-run: an existing parent with that username gets
its password/email/name updated rather than erroring, so it also works as a
password reset. Log in with those credentials in the frontend, then use its
dashboard to add children normally.

### Signing in with Google (optional)

Parents can also create/sign into their account from the front page ("Sign
in with Google", `POST /api/auth/google/`) — no `create_initial_parent`
step needed if this is set up, since it's its own open self-registration
entrypoint (a first-time Google identity gets a new parent account, same
as self-registering with a username/password). To enable it:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an OAuth 2.0 Client ID of type "Web application".
2. Under "Authorized JavaScript origins", add every origin the frontend is
   served from (e.g. `http://localhost:5173` for `bun run dev`,
   `https://bank.example.com` in production).
3. Set `GOOGLE_OAUTH_CLIENT_ID` in `backend/.env` to the resulting client
   id, then restart/redeploy the backend.

Left unset (the default), the frontend's login page simply omits the
Google button — no broken control, no backend error.

### Before deploying anywhere but a trusted local/staging host

`backend/.env` ships with dev-only values (a placeholder `SECRET_KEY`, a
simple Postgres password) and `ALLOWED_HOSTS=*`/`CORS_ALLOW_ALL_ORIGINS=True`
defaults, so the stack "just works" without extra setup. For anything
internet-facing:

- Replace `SECRET_KEY` and `POSTGRES_PASSWORD` in `backend/.env` with real
  random values.
- Set `ALLOWED_HOSTS` to your actual domain(s).
- Put TLS termination in front of the `frontend` service (e.g. put it behind
  an existing reverse proxy, or add a Caddy/nginx layer that terminates
  HTTPS and forwards to port 80) — nothing here terminates TLS itself.
  `frontend`'s nginx forwards whatever `X-Forwarded-Proto` that proxy sets
  through to the backend unmodified, and `backend/api/settings.py` trusts it
  (`SECURE_PROXY_SSL_HEADER`) so Django's CSRF check sees the real `https://`
  origin — without a proxy setting that header, logging into `/admin/` over
  HTTPS fails CSRF verification. Set `CSRF_TRUSTED_ORIGINS` in `backend/.env`
  (e.g. `https://bank.example.com`) if your proxy doesn't forward the
  original `Host` header unchanged. Because this trust is unconditional,
  don't publish `BACKEND_PORT` on a host reachable from outside your proxy
  — that would let a direct request spoof `X-Forwarded-Proto` itself.
- Point `CELERY_BROKER_URL`/`CELERY_RESULT_BACKEND` at a durable, backed-up
  Redis instance if you need queued jobs to survive a host failure (the
  bundled `redis` service has no persistence configured).
- Back up the `postgres_data` volume.
