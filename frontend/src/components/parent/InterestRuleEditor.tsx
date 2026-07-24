import { useState, type FormEvent } from "react";
import { interestRulesApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { InterestRule, InterestSchedule, ReconciliationRow } from "../../types/api";
import { WEEKDAY_LABELS, formatDateTime } from "../../lib/format";
import { Card, CardHeader, ErrorAlert, Label, PrimaryButton, inputClass } from "../ui";

// See AllowanceRuleEditor for why `guardians` only lists parents with a
// posted transaction -- the reconciliation endpoint is the only source the
// API exposes for co-guardians to a non-primary guardian.
export function InterestRuleEditor({
  childId,
  currentParentId,
  guardians,
  rule,
  onSaved,
}: {
  childId: number;
  currentParentId: number;
  guardians: ReconciliationRow[];
  rule: InterestRule | null;
  onSaved: (rule: InterestRule) => void;
}) {
  const [annualRatePct, setAnnualRatePct] = useState(
    rule ? (Number.parseFloat(rule.annual_rate) * 100).toString() : "",
  );
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
        annual_rate: (Number.parseFloat(annualRatePct) / 100).toFixed(4),
        schedule,
        weekday,
        day_of_month: dayOfMonth,
        hour,
        enabled,
      };
      const saved = rule ? await interestRulesApi.update(rule.id, payload) : await interestRulesApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the interest rule."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Interest rate"
        subtitle={rule ? `Next accrual: ${formatDateTime(rule.next_run_at)}` : "No interest rule configured yet"}
      />
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
        {error && <ErrorAlert message={error} />}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Annual rate (%)</Label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={annualRatePct}
              onChange={(e) => setAnnualRatePct(e.target.value)}
              className={inputClass}
              placeholder="e.g. 5.00"
            />
          </div>
          <div>
            <Label>Schedule</Label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as InterestSchedule)}
              className={inputClass}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {schedule === "weekly" ? (
            <div>
              <Label>Day of week</Label>
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className={inputClass}>
                {WEEKDAY_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <Label>Day of month</Label>
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
            <Label>Posting hour</Label>
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
            <Label>Funded by</Label>
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
          Rule enabled
        </label>

        <PrimaryButton type="submit" disabled={saving} className="w-full">
          {saving ? "Saving\u2026" : rule ? "Save changes" : "Create interest rule"}
        </PrimaryButton>
      </form>
    </Card>
  );
}
