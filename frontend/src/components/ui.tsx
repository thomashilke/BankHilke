import type { HTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-ink-200 bg-paper shadow-sm shadow-ink-900/[0.02] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-ink-400">{children}</p>;
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-8 text-sm text-ink-400">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600" />
      {label}&hellip;
    </div>
  );
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  allowance: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200",
  interest: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  deposit: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
  withdrawal: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
};

export function TransactionTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const style = TYPE_BADGE_STYLES[type] ?? "bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}>
      {t(`transactionType.${type}`)}
    </span>
  );
}

export function PrimaryButton({
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-md bg-brand-700 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

export function SecondaryButton({
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-md border border-ink-200 px-3.5 py-2 text-sm font-medium text-ink-700 transition hover:border-ink-300 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-ink-500">{children}</label>;
}

export const inputClass =
  "w-full rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-400";
