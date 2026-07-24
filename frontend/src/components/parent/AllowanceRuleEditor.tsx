import { useState, type FormEvent } from "react";
import { allowanceRulesApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import type { AllowanceRule, ReconciliationRow } from "../../types/api";
import { WEEKDAY_LABELS, formatDateTime } from "../../lib/format";
import { Card, CardHeader, ErrorAlert, Label, PrimaryButton, inputClass } from "../ui";

// `guardians` is derived from the reconciliation endpoint (the only source
// the API exposes for co-guardians of a shared child to a non-primary
// guardian), so it only lists parents with at least one posted transaction.
export function AllowanceRuleEditor({
  childId,
  currentParentId,
  guardians,
  rule,
  onSaved,
}: {
  childId: number;
  currentParentId: number;
  guardians: ReconciliationRow[];
  rule: AllowanceRule | null;
  onSaved: (rule: AllowanceRule) => void;
}) {
  const [amount, setAmount] = useState(rule?.amount ?? "");
  const [weekday, setWeekday] = useState(rule?.weekday ?? 6);
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
        amount,
        weekday,
        hour,
        enabled,
      };
      const saved = rule ? await allowanceRulesApi.update(rule.id, payload) : await allowanceRulesApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the allowance rule."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Weekly allowance"
        subtitle={rule ? `Next posting: ${formatDateTime(rule.next_run_at)}` : "No allowance configured yet"}
      />
      <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
        {error && <ErrorAlert message={error} />}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Amount (USD / week)</Label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </div>
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
          {saving ? "Saving\u2026" : rule ? "Save changes" : "Create allowance rule"}
        </PrimaryButton>
      </form>
    </Card>
  );
}
