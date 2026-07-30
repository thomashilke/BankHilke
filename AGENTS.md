# Repository Guidelines

## Project Overview

BankHilke ("hilkebank") is a Django REST API for a family banking app: parents
act as "the bank" for their children. Each user (parent or child) has an
`Account`; every money movement (weekly allowance, interest accrual,
parent-advanced withdrawal, manual deposit) posts a **double-entry**
transaction — one debit leg and one credit leg of equal amount, so account
balances are always derived from the ledger, never stored/drifting. Allowance
and interest accruals are scheduled per child and posted automatically by a
Celery beat + worker pair, catching up on any missed periods after downtime.

A React + TypeScript + Tailwind frontend lives in `frontend/` (Vite-built,
role-gated parent/child dashboards consuming this API; see
`frontend/README.md` for its own structure and dev workflow, and the root
`README.md` for the full-stack `docker compose up -d --build` deploy).

## Architecture & Data Flow

- Django project package: `backend/api/` (`settings.py`, `urls.py`,
  `celery.py`, `asgi.py`, `wsgi.py`). The Celery app is `api.celery.app`,
  exported as `celery_app` from `backend/api/__init__.py` (`celery -A api ...`).
- Four Django apps under `backend/apps/`:
  - **`users`** — `User(AbstractUser)` with `role` (`User.PARENT`/`User.CHILD`),
    a `pin` field (reserved, not used by the API yet), and `google_sub`
    (nullable, unique -- set once an account signs in via "Sign in with
    Google"). `services.GoogleAuthService` verifies a Google Identity
    Services credential and resolves it to a User, creating a new parent
    account on first sign-in (this doubles as account creation: there's no
    separate signup step) or linking it to an existing account by
    Google-verified email; a Google-only account never gets a usable
    password (`set_unusable_password`), which is what `UserSerializer`'s
    `has_usable_password` field lets the frontend key off to hide the
    "change password" control for those accounts. `Guardianship` links a
    parent to a child they're financially responsible for; a child can
    have **multiple** guardians (e.g. divorced parents), which is what
    makes per-parent reconciliation possible. Exactly one guardian per
    child is flagged `is_creator=True` -- the parent who registered the
    child's account via `POST /users/` (see `UserViewSet.perform_create`).
    `services.AccountDeletionService` backs the only destructive operation
    the API exposes, `DELETE /users/{id}/` (see `CanDeleteAccount`): a
    parent may delete their own account, or a child's account only if they
    created it; a child can never delete any account (their own included),
    and a non-creating guardian can only unlink themselves via
    `DELETE /guardianships/{id}/`, never delete the child outright.
    Deleting a user cascades onto everything owned by that account via each
    model's `on_delete=models.CASCADE`, and when the deleted user is a
    parent, any child left with no remaining guardian is deleted too, in
    the same atomic transaction.
  - **`accounts`** — `Account` (`OneToOneField` to `User`), auto-created for
    every new `User` via a `post_save` signal (`apps/accounts/signals.py`).
    `Account.balance` is a `@property` computed on read: sum of `credit`
    ledger entries minus `debit` entries — never a stored column, so it can
    never drift from history.
  - **`transactions`** — the ledger core:
    - `Transaction` — one row per business event (`allowance` / `interest` /
      `withdrawal` / `deposit`), recording `child_account`, `parent_account`,
      `amount`, `initiated_by` (null for scheduled events), a unique
      `idempotency_key`, and an optional `reverses` (self `OneToOneField`)
      pointing at the transaction it cancels out, if any.
      `Transaction.objects.visible()` excludes both legs of a reversal pair
      (the reversed original and its reversal) from every listing/aggregate
      -- reversing a movement is meant to make it as if it never happened.
    - `LedgerEntry` — exactly two rows per `Transaction` (one `debit`, one
      `credit`, equal `amount`), each pointing at an `Account`.
    - `services.LedgerService` — the **only** way transactions get posted
      (`allowance`, `interest`, `deposit`, `withdrawal`, `reverse` static
      methods). Allowance/interest/deposit debit the parent and credit the
      child; withdrawal debits the child and credits the advancing parent;
      `reverse` posts a new transaction with the same debit/credit legs
      swapped (parent-only, via `POST /transactions/{id}/reverse/`), then
      relies on `visible()` to hide the pair. `withdrawal`/`reverse` each
      lock the affected row (`select_for_update`) and reject amounts that
      would take a balance negative (`InsufficientFundsError`).
      Every posting is idempotent: a repeated `idempotency_key` returns the
      already-posted `Transaction` instead of creating a duplicate (relies on
      the DB unique constraint + catching `IntegrityError`).
  - **`allowances`** — per-child schedule configuration and the scheduler:
    - `AllowanceRule` (weekly: `weekday`/`hour`, `amount`, `funding_parent`)
      and `InterestRule` (`rate`, `schedule` = weekly or monthly,
      independently configurable) each carry a `next_run_at` cursor. `rate`
      is applied directly at each accrual -- the rate for one occurrence of
      `schedule`, not an annualized figure divided down -- so the amount a
      parent configures is the amount actually transferred each period.
    - `scheduling.py` — pure datetime helpers (`next_weekly_occurrence`,
      `next_monthly_occurrence`) shared by the model defaults and the task.
    - `tasks.process_due_accruals` — the Celery task (see beat schedule
      below). For every enabled rule whose `next_run_at` has passed, it
      posts via `LedgerService` and advances `next_run_at` to the next
      occurrence, **looping** until caught up to "now" — this is what makes
      downtime catch-up and idempotent reprocessing work: posting the
      transaction and advancing the cursor happen in one DB transaction, so
      a crash mid-loop simply retries the same unposted period on the next
      run.
- Request flow: DRF `ModelViewSet`/`ReadOnlyModelViewSet`s registered on a
  `DefaultRouter` in `backend/api/urls.py`, mounted under `/api/`.
- Scheduling flow: `api/celery.py` registers `process_due_accruals` on
  `app.conf.beat_schedule` via `crontab(minute="*/15")`; `celery-beat` enqueues
  it, `celery-worker` executes it, both against Redis (`docker-compose.backend-test.yml`).

## Key Directories

- `backend/api/` — Django project config, URL routing, Celery app, shared DRF
  permission classes (`api/permissions.py`).
- `backend/apps/users/` — `User`, `Guardianship`, registration + guardianship
  API, `services.GoogleAuthService` ("Sign in with Google").
- `backend/apps/accounts/` — `Account`, balance/history/reconciliation API.
- `backend/apps/transactions/` — `Transaction`, `LedgerEntry`,
  `LedgerService`, deposit/withdraw API.
- `backend/apps/allowances/` — `AllowanceRule`, `InterestRule`, scheduling
  helpers, the Celery catch-up task, rule config API.
- `frontend/` — React + TypeScript + Tailwind parent/child banking UI (Vite);
  see `frontend/README.md`.

## Development Commands

```sh
make run-backend    # docker compose up -d (backend, postgres, redis, celery-worker, celery-beat) + migrate
make stop-backend    # docker compose down
make reload           # restart the backend container
make create-parent   # bootstrap/reset the first parent login; see README.md
make deploy          # full-stack production-ish deploy: docker compose up -d --build
                      # (backend/gunicorn, frontend/nginx, postgres, redis, celery); see README.md
make undeploy         # docker compose down
```

Manual equivalents:

```sh
python manage.py runserver 0.0.0.0:8000
python manage.py makemigrations
python manage.py migrate
python manage.py test                       # full suite
python manage.py create_parent               # bootstrap/reset the first parent login (see README.md)
python manage.py createsuperuser              # Django admin login -- note: leaves `role` unset, unlike create_parent
celery -A api worker -l info                # process scheduled accruals
celery -A api beat -l info                  # dispatch process_due_accruals every 15 min
```

`docker-compose.backend-test.yml` (the file the Makefile's `run-backend`/
`stop-backend`/`reload`/`create-parent` targets drive) runs the full dev
stack: `backend` (live-reload `runserver`), `postgres`, `redis`,
`celery-worker`, `celery-beat`. The root `docker-compose.yml` (driven by
`make deploy`/`make undeploy`) is the production-ish stack instead:
gunicorn + WhiteNoise-served static assets, the React frontend behind
nginx, `DEBUG` forced off. Both compose files pin distinct Compose project
names (`hilkebank-dev` / `hilkebank-deploy`) so they can't silently steal
each other's containers if both happen to be brought up in the same
environment -- they can still collide on published ports (8000, 5432) if
run simultaneously, so don't do that (or override with `BACKEND_PORT=<port>`,
honored by both compose files -- see README.md).

No lint/format/type-check command is configured (no `pyproject.toml`,
`.flake8`, `ruff.toml`, etc. — `pyright` is listed in `requirements.txt` but
has no config driving it).

## Code Conventions & Common Patterns

- App layout is uniform: `models.py`, `serializers.py`, `views.py`,
  `admin.py`, `apps.py`, `migrations/`; business logic that isn't pure CRUD
  goes in a `services.py` (see `transactions/services.py`), not inline in the
  viewset.
- Imports of app modules use the `apps.<app>.<module>` dotted path (project
  root on `sys.path` is `backend/`).
- **Never mutate a balance directly.** All money movement goes through
  `LedgerService`, which always writes a matched debit+credit pair. If you
  add a new transaction type, add a method to `LedgerService`, not a
  standalone `Transaction.objects.create()`.
- **Idempotency by construction**: any code that posts a transaction outside
  a direct user request (i.e. anything scheduled/replayable) must pass a
  deterministic `idempotency_key` (see `f"allowance:{rule.id}:{due_at.isoformat()}"`)
  so retries/replays are safe.
- Permission pattern: role checks (`IsParent`/`IsChild` in `api/permissions.py`)
  gate *who can act*; `Guardianship.objects.filter(parent=..., child=...).exists()`
  checks gate *which child* they can act on. Both are checked explicitly in
  each write path (`perform_create`, the `deposit`/`withdraw` actions,
  `GuardianRuleViewSet`) — DRF's declarative `permission_classes` alone can't
  express "guardian of this specific child".
- Derived values are Python `@property`s computed from related rows
  (`Account.balance`), never stored/cached columns.
- Env-driven config: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, DB credentials,
  and `CELERY_BROKER_URL`/`CELERY_RESULT_BACKEND` all read from `os.getenv`
  with dev-safe defaults in `backend/api/settings.py` — follow that pattern
  for new settings rather than hardcoding.

## Important Files

- `backend/manage.py` — management entrypoint.
- `backend/api/settings.py` — Django/DRF/Celery/DB configuration.
- `backend/api/urls.py` — API routing.
- `backend/api/celery.py` — Celery app + beat schedule.
- `backend/api/permissions.py` — shared `IsParent`/`IsChild` DRF permissions.
- `backend/apps/transactions/services.py` — `LedgerService`, the only
  sanctioned way to move money.
- `backend/apps/allowances/tasks.py` — `process_due_accruals`, the
  idempotent catch-up scheduler.
- `backend/apps/allowances/scheduling.py` — next-occurrence datetime math.
- `backend/apps/accounts/signals.py` — auto-creates an `Account` for every
  new `User`.
- `backend/requirements.txt` — Django 6.0.5, DRF 3.17.1,
  `djangorestframework_simplejwt`, Celery 5.6.3 + `redis`, `psycopg` 3,
  `django-guardian`, `django-filter`, `django-cors-headers`, `google-auth`
  (Google ID token verification for "Sign in with Google").
- `backend/.env` — `DEBUG`, `SECRET_KEY`, `POSTGRES_*`,
  `GOOGLE_OAUTH_CLIENT_ID` (optional). Not gitignored — don't put real
  secrets in it.

## Runtime/Tooling Preferences

- Python 3.13 (`backend/Dockerfile`, `python:3.13-slim`).
- `pip` + `requirements.txt` (no Poetry/uv/Pipenv).
- No linter/formatter/pre-commit configured — match existing style (PEP 8,
  trailing-comma multi-line calls as seen throughout).
- Docker Compose is the primary way to run the stack; Postgres 17 and Redis 8
  are required (Celery broker/result backend both point at the `redis`
  service by default — see `CELERY_BROKER_URL`/`CELERY_RESULT_BACKEND` in
  `settings.py`).

## API Surface (all under `/api/`, JWT auth via `/api/auth/{login,refresh,verify}/`, plus Google via `/api/auth/google/`)

- `POST /users/` — register. `role=parent` is open (`AllowAny`); `role=child`
  requires an authenticated parent, who becomes the child's first guardian.
- `GET/PATCH /users/{id}/` — self, or (for a parent) a child they guard;
  includes read-only `has_usable_password` (false for Google-only accounts).
- `DELETE /users/{id}/` — the only account-destroying operation the API
  exposes (see `CanDeleteAccount`): a parent may delete their own account,
  or a child's account they created; a child can never delete any account.
  Cascades onto everything the account owns, and if the deleted user is a
  parent, any child left with no remaining guardian is deleted too (see
  `AccountDeletionService`).
- `POST /guardianships/` — an authenticated parent links themselves as an
  additional guardian of an existing child (divorced-parents reconciliation).
- `DELETE /guardianships/{id}/` — a parent unlinks one of their own
  guardianship links; the only way a non-creating guardian can detach from
  a child (never deletes the child itself).
- `GET /accounts/` — accounts visible to the caller (own + guarded children
  for a parent; own only for a child).
- `GET /accounts/{id}/` — current balance.
- `GET /accounts/{id}/history/` — paginated transaction history.
- `GET /accounts/{id}/reconciliation/` — child accounts only: per-guardian
  totals given/taken/net.
- `GET /transactions/` — history scoped to the caller (excludes reversed
  transactions and reversals themselves, see `Transaction.objects.visible()`).
- `POST /transactions/deposit/`, `POST /transactions/withdraw/` — parent-only,
  requires the caller to be a guardian of `child_account`'s owner; withdrawal
  rejects amounts exceeding the current balance.
- `POST /transactions/{id}/reverse/` — parent-only, guardian-scoped; posts an
  offsetting transaction and hides both from every listing/aggregate.
- `GET /auth/google/` — public config (`{client_id}`) the frontend needs to
  render Google's button; empty when unconfigured.
- `POST /auth/google/` — exchange a Google credential for this app's JWT
  pair, creating a new parent account on first sign-in (or linking to an
  existing account by Google-verified email) — the front-page account
  creation entrypoint.
- `GET/POST/PATCH /allowance-rules/`, `/interest-rules/` — guardian-only
  writes, `funding_parent` must itself be a guardian of `child`; children get
  read-only access to their own rule(s).

## Testing & QA

Django's built-in test runner (`python manage.py test`) — no pytest, no CI
configured. 111 tests across the four apps:

- `apps/transactions/tests.py` — `LedgerService` double-entry correctness
  (offsetting debit/credit, balance = allowances + interest + deposits −
  withdrawals), insufficient-funds rejection, idempotent replay, transaction
  reversal (offsetting entries, hidden from listings, idempotent), and
  deposit/withdraw/reverse API permission boundaries (parent-only,
  guardian-only, history scoping).
- `apps/allowances/tests.py` — scheduling helper correctness (weekly wrap,
  monthly short-month clamping), `process_due_accruals` posting + cursor
  advance, **idempotent rerun** (no double-post), **downtime catch-up**
  (N missed weekly periods → exactly N transactions, one run), interest
  accrual amount, and rule-config API permissions (guardian-only writes,
  `funding_parent` must be a guardian).
- `apps/users/tests.py` — self-registration (parent, open) vs. gated child
  creation (parent-only, auto-guardianship), password hashing/login,
  self-service password change (rejected for Google-only accounts, which
  have no password to change), Google sign-in (new-account creation, repeat
  sign-in reuses the account, verified-email linking to an existing
  account, unique username generation), guardianship linking, and
  account-deletion permission boundaries (a parent may delete their own
  account or a child's account only if they created it; a child can never
  delete any account; a non-creating guardian can only unlink themselves),
  and the cascade onto a sole-guardian child while a co-guardian's own
  link/data survives.
- `apps/accounts/tests.py` — visibility scoping (child sees only self, parent
  sees self + guarded children, unrelated parent sees neither), balance,
  history (excludes reversed transactions), and reconciliation correctness.

Run inside the backend container: `docker compose -f
docker-compose.backend-test.yml exec backend python manage.py test`. `apps`
needed an `__init__.py` (previously a namespace package) for Django's test
discovery to find it — already added.

Note: this is dev-stage seed data, no fixtures/factories are set up; each
test creates its own users/accounts via `User.objects.create_user(...)`.
