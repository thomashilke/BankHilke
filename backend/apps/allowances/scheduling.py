"""Pure datetime helpers for computing the next occurrence of a per-child
schedule. Kept separate from models.py/tasks.py so both the model's initial
`next_run_at` default and the task's catch-up loop use one implementation.
"""

import calendar
from datetime import timedelta


def next_weekly_occurrence(after, weekday, hour):
    """Smallest timezone-aware datetime strictly greater than `after` that
    falls on `weekday` (0=Monday..6=Sunday, matching date.weekday()) at
    `hour`:00.
    """
    candidate = after.replace(hour=hour, minute=0, second=0, microsecond=0)
    days_ahead = (weekday - candidate.weekday()) % 7
    candidate += timedelta(days=days_ahead)
    if candidate <= after:
        candidate += timedelta(days=7)
    return candidate


def next_monthly_occurrence(after, day_of_month, hour):
    """Smallest timezone-aware datetime strictly greater than `after` that
    falls on `day_of_month` (1-31, clamped to the last day of short months)
    at `hour`:00.
    """
    def build(year, month):
        day = min(day_of_month, calendar.monthrange(year, month)[1])
        return after.replace(year=year, month=month, day=day, hour=hour, minute=0, second=0, microsecond=0)

    candidate = build(after.year, after.month)
    if candidate <= after:
        month = after.month + 1
        year = after.year
        if month > 12:
            month = 1
            year += 1
        candidate = build(year, month)
    return candidate
