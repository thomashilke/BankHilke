import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { AllowanceRule, Currency, InterestRule } from "../types/api";
import { formatCurrency, formatCountdown, formatDateTime } from "../lib/format";
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

function projectAllowanceEvents(rule: AllowanceRule, currency: Currency, t: TFunction): UpcomingEvent[] {
  if (!rule.enabled) return [];
  const occurrences = projectOccurrences(new Date(rule.next_run_at), EVENTS_PER_RULE, (after) =>
    nextWeeklyOccurrence(after, rule.weekday, rule.hour),
  );
  return occurrences.map((at, index) => ({
    key: `allowance-${rule.id}-${index}`,
    type: "allowance",
    label: t("allowance.title"),
    amountLabel: t("upcoming.creditedAmount", { amount: formatCurrency(rule.amount, currency) }),
    at,
  }));
}

function projectInterestEvents(rule: InterestRule, currentBalance: number, currency: Currency, t: TFunction): UpcomingEvent[] {
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
    label: t("upcoming.interestLabel", {
      schedule: t(`common.${rule.schedule}`),
      rate: (Number.parseFloat(rule.annual_rate) * 100).toFixed(2),
    }),
    amountLabel: t("upcoming.estimatedAmount", { amount: formatCurrency(estimatedAmount, currency) }),
    at,
  }));
}

export function UpcomingEvents({
  allowanceRule,
  interestRule,
  currentBalance,
  currency,
}: {
  allowanceRule: AllowanceRule | null;
  interestRule: InterestRule | null;
  currentBalance: number;
  currency: Currency;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const events = [
    ...(allowanceRule ? projectAllowanceEvents(allowanceRule, currency, t) : []),
    ...(interestRule ? projectInterestEvents(interestRule, currentBalance, currency, t) : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <Card>
      <CardHeader title={t("upcoming.title")} subtitle={t("upcoming.subtitle")} />
      {events.length === 0 ? (
        <EmptyState>{t("upcoming.empty")}</EmptyState>
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
                  <p className="text-xs text-ink-400">{formatDateTime(event.at.toISOString())}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold tabular text-ink-900">{event.amountLabel}</p>
                <p className="text-xs font-medium text-brand-600">{formatCountdown(event.at, now, t)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
