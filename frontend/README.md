# BankHilke frontend

React + TypeScript + Tailwind CSS (v4) front-end for the BankHilke family
allowance banking API (`backend/api`).

## Stack

- Vite + React 19 + TypeScript
- React Router for client-side routing and role-based route guards
- Axios for API access, with an interceptor that refreshes the JWT access
  token on 401 and signs the user out if the refresh token is also invalid
- Tailwind CSS v4 (CSS-first config, see `src/index.css`)

## Development

```sh
bun install
bun run dev      # http://localhost:5173, proxies /api -> http://localhost:8000
bun run build    # tsc -b && vite build
bun run lint     # oxlint
```

The dev server proxies `/api/*` requests to the Django backend (see
`vite.config.ts`), so no `.env` is required locally as long as the backend
runs on `localhost:8000` (`make run-backend`). In production, set
`VITE_API_BASE_URL` if the API isn't served from the same origin.

## Structure

- `src/auth/` — `AuthProvider`/`useAuth` (JWT storage + profile loading from
  the token's `user_id` claim) and `ProtectedRoute` (auth + role gating).
- `src/api/` — `client.ts` (axios instance, refresh interceptor, error
  formatting) and `endpoints.ts` (typed calls mirroring the DRF viewsets).
- `src/types/api.ts` — TypeScript types mirroring the DRF serializers.
- `src/lib/` — formatting helpers and a client-side mirror of
  `backend/apps/allowances/scheduling.py`, used only to project a few future
  allowance/interest occurrences beyond the single `next_run_at` the API
  returns (the backend remains the source of truth for what actually posts).
- `src/pages/child/` — balance, transaction history, upcoming events
  (read-only; children cannot initiate transactions).
- `src/pages/parent/` — children list, per-child deposit/withdraw, allowance
  and interest rule editors, and the shared-guardianship reconciliation
  panel (`accounts/{id}/reconciliation/`).
