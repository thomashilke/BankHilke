// Mirrors the DRF serializers in backend/apps/*/serializers.py exactly.
// Decimal-valued fields (amount, balance, annual_rate, ...) come over the
// wire as strings, matching DRF's DecimalField JSON rendering.

export type Role = "parent" | "child";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
}

export interface Guardianship {
  id: number;
  parent: number;
  parent_username: string;
  child: number;
  child_username: string;
  created_at: string;
}

export type LinkGuardianInput = { child: number; username?: string };

export interface Account {
  id: number;
  owner: number;
  owner_username: string;
  role: Role;
  balance: string;
  created_at: string;
}

export type TransactionType = "allowance" | "interest" | "withdrawal" | "deposit";

export type LedgerDirection = "debit" | "credit";

export interface LedgerEntry {
  id: number;
  account: number;
  direction: LedgerDirection;
  amount: string;
}

export interface Transaction {
  id: number;
  transaction_type: TransactionType;
  child_account: number;
  parent_account: number;
  amount: string;
  description: string;
  initiated_by: number | null;
  created_at: string;
  entries: LedgerEntry[];
}

export interface ManualTransactionInput {
  child_account: number;
  amount: string;
  description?: string;
}

// weekday: 0=Monday .. 6=Sunday (matches Python date.weekday())
export interface AllowanceRule {
  id: number;
  child: number;
  funding_parent: number;
  amount: string;
  weekday: number;
  hour: number;
  enabled: boolean;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

export type AllowanceRuleInput = Pick<
  AllowanceRule,
  "child" | "funding_parent" | "amount" | "weekday" | "hour" | "enabled"
>;

export type InterestSchedule = "weekly" | "monthly";

export interface InterestRule {
  id: number;
  child: number;
  funding_parent: number;
  annual_rate: string;
  schedule: InterestSchedule;
  weekday: number;
  day_of_month: number;
  hour: number;
  enabled: boolean;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

export type InterestRuleInput = Pick<
  InterestRule,
  "child" | "funding_parent" | "annual_rate" | "schedule" | "weekday" | "day_of_month" | "hour" | "enabled"
>;

export interface ReconciliationRow {
  parent_id: number;
  parent_username: string;
  total_given: number;
  total_taken: number;
  net_contribution: number;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

// Generic shape for DRF field/non-field validation errors.
export type ApiErrorBody = Record<string, string[] | string> | { detail?: string };
