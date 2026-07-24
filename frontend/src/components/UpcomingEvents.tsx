import { useEffect, useState } from "react";
import type { AllowanceRule, InterestRule } from "../types/api";
import { formatCurrency, formatCountdown } from "../lib/format";
import { nextMonthlyOccurrence, nextWeeklyOccurrence, projectOccurrences } from "../lib/schedule";
import { Card, CardHeader, EmptyState } from "./ui";

interface UpcomingEvent {
  key: string;
  type: "allowance" | "interest";
  label: string;
  amountLabel: string;
  at: Date;
}

const EVENTS_PER_RULE = 3;

function projectAllowanceEvents(rule: AllowanceRule): UpcomingEvent[] {
  if (!rule.enabled) return [];
  const occurrences = projectOccurrences(new Date(rule.next_run_at), EVENTS_PER_RULE, (after) =>
    nextWeeklyOccurrence(after, rule.weekday, rule.hour),
  );
  return occurrences.map((at, index) => ({
    key: `allowance-${rule.id}-${index}`,
    type: "allowance",
    label: "Weekly allowance",
    amountLabel: `+${formatCurrency(rule.amount)}`,
    at,
  }));
}

function projectInterestEvents(rule: InterestRule, currentBalance: number): UpcomingEvent[] {
  if (!rule.enabled) return [];
  const step = rule.schedule === "weekly"
    ? (after: Date) => nextWeeklyOccurrence(after, rule.weekday, rule.hour)
    : (after: Date) => nextMonthlyOccurrence(after, rule.day_of_month, rule.hour);
  const occurrences = projectOccurrences(new Date(rule.next_run_at), EVENTS_PER_RULE, step);
  const periodsPerYear = rule.schedule === "weekly" ? 52 : 12;
  const periodRate = Number.parseFloat(rule.annual_rate) / periodsPerYear;
  const estimatedAmount = currentBalance * periodRate;
  return occurrences.map((at, index) => ({
    key: `interest-${rule.id}-${index}`,
    type: "interest",
    label: `Interest (${rule.schedule}, ${(Number.parseFloat(rule.annual_rate) * 100).toFixed(2)}%/yr)`,
    amountLabel: `\u2248 ${formatCurrency(estimatedAmount)}`,
    at,
  }));
}

export function UpcomingEvents({
  allowanceRule,
  interestRule,
  currentBalance,
}: {
  allowanceRule: AllowanceRule | null;
  interestRule: InterestRule | null;
  currentBalance: number;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const events = [
    ...(allowanceRule ? projectAllowanceEvents(allowanceRule) : []),
    ...(interestRule ? projectInterestEvents(interestRule, currentBalance) : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <Card>
      <CardHeader title="Upcoming events" subtitle="Scheduled allowance and interest postings" />
      {events.length === 0 ? (
        <EmptyState>No upcoming events configured yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-ink-100">
          {events.map((event) => (
            <li key={event.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    event.type === "allowance" ? "bg-brand-500" : "bg-emerald-500"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-ink-800">{event.label}</p>
                  <p className="text-xs text-ink-400">{event.at.toLocaleString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold tabular text-ink-900">{event.amountLabel}</p>
                <p className="text-xs font-medium text-brand-600">{formatCountdown(event.at, now)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
