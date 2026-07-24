#!/usr/bin/env sh
# Bootstraps the first parent account, so there's a way to log in on a fresh
# database. Safe to re-run: it updates that account (password/email/name)
# instead of failing if the username already exists.
#
# Config comes from the environment (INITIAL_PARENT_USERNAME,
# INITIAL_PARENT_PASSWORD, INITIAL_PARENT_EMAIL, INITIAL_PARENT_FIRST_NAME,
# INITIAL_PARENT_LAST_NAME, INITIAL_PARENT_SUPERUSER) if set -- e.g. export
# them or add them to backend/.env before running via docker compose, which
# loads that file automatically. Anything missing is prompted for
# interactively, unless --no-input is passed (then it's a hard error).
# Flags override the environment: see `python manage.py create_parent --help`.
#
# Usage:
#   dev stack:   docker compose -f docker-compose.backend-test.yml exec backend \
#                  ./scripts/create_initial_parent.sh
#   deploy stack: docker compose exec backend ./scripts/create_initial_parent.sh
#   outside Docker (from backend/): ./scripts/create_initial_parent.sh
set -eu
cd "$(dirname "$0")/.."
exec python manage.py create_parent "$@"
