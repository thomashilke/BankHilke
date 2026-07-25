import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { interestRulesApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { Currency, InterestRule, InterestSchedule, ReconciliationRow } from "../../types/api";
import { WEEKDAY_KEYS, formatCurrency, formatDateTime } from "../../lib/format";
import { Card, CardHeader, ErrorAlert, Label, PrimaryButton, inputClass } from "../ui";

// See AllowanceRuleEditor for why `guardians` only lists parents with a
// posted transaction -- the reconciliation endpoint is the only source the
// API exposes for co-guardians to a non-primary guardian.
export function InterestRuleEditor({
  childId,
  currentParentId,
  guardians,
  rule,
  currency,
  currentBalance,
  onSaved,
}: {
  childId: number;
  currentParentId: number;
  guardians: ReconciliationRow[];
  rule: InterestRule | null;
  currency: Currency;
  currentBalance: number;
  onSaved: (rule: InterestRule) => void;
}) {
  const { t } = useTranslation();
  const [ratePct, setRatePct] = useState(rule ? (Number.parseFloat(rule.rate) * 100).toString() : "");
  const [schedule, setSchedule] = useState<InterestSchedule>(rule?.schedule ?? "monthly");
  const [weekday, setWeekday] = useState(rule?.weekday ?? 6);
  const [dayOfMonth, setDayOfMonth] = useState(rule?.day_of_month ?? 1);
  const [hour, setHour] = useState(rule?.hour ?? 9);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [fundingParent, setFundingParent] = useState(rule?.funding_parent ?? currentParentId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        child: childId,
        funding_parent: fundingParent,
        rate: (Number.parseFloat(ratePct) / 100).toFixed(4),
        schedule,
        weekday,
        day_of_month: dayOfMonth,
        hour,
        enabled,
      };
      const saved = rule ? await interestRulesApi.update(rule.id, payload) : await interestRulesApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(apiErrorMessage(err, t("interest.error")));
    } finally {
      setSaving(false);
    }
  }

  const rateValue = Number.parseFloat(ratePct);
  const estimatedAmount = Number.isFinite(rateValue) && currentBalance > 0 ? currentBalance * (rateValue / 100) : null;
  return (
    <Card>
      <CardHeader
        title={t("interest.title")}
        subtitle={rule ? t("interest.nextAccrual", { date: formatDateTime(rule.next_run_at) }) : t("interest.notConfigured")}
      />
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
        {error && <ErrorAlert message={error} />}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t(schedule === "weekly" ? "interest.rateLabelWeekly" : "interest.rateLabelMonthly")}</Label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={ratePct}
              onChange={(e) => setRatePct(e.target.value)}
              className={inputClass}
              placeholder={t("interest.ratePlaceholder")}
            />
            {estimatedAmount !== null && (
              <p className="mt-1 text-xs text-ink-400">
                {t("interest.ratePreview", {
                  amount: formatCurrency(estimatedAmount, currency),
                  period: t(`common.${schedule === "weekly" ? "week" : "month"}`),
                })}
              </p>
            )}
          </div>
          <div>
            <Label>{t("interest.scheduleLabel")}</Label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as InterestSchedule)}
              className={inputClass}
            >
              <option value="weekly">{t("common.weekly")}</option>
              <option value="monthly">{t("common.monthly")}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {schedule === "weekly" ? (
            <div>
              <Label>{t("common.dayOfWeek")}</Label>
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className={inputClass}>
                {WEEKDAY_KEYS.map((key, index) => (
                  <option key={key} value={index}>
                    {t(`weekday.${key}`)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <Label>{t("interest.dayOfMonthLabel")}</Label>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <Label>{t("common.postingHour")}</Label>
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className={inputClass}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h.toString().padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
        </div>

        {guardians.length > 1 && (
          <div>
            <Label>{t("common.fundedBy")}</Label>
            <select
              value={fundingParent}
              onChange={(e) => setFundingParent(Number(e.target.value))}
              className={inputClass}
            >
              {guardians.map((g) => (
                <option key={g.parent_id} value={g.parent_id}>
                  {g.parent_username}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-200"
          />
          {t("common.ruleEnabled")}
        </label>

        <PrimaryButton type="submit" disabled={saving} className="w-full">
          {saving ? t("common.saving") : rule ? t("common.saveChanges") : t("interest.create")}
        </PrimaryButton>
      </form>
    </Card>
  );
}
