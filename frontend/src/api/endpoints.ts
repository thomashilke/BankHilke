import { api } from "./client";
import type {
  Account,
  AllowanceRule,
  AllowanceRuleInput,
  Guardianship,
  InterestRule,
  InterestRuleInput,
  ManualTransactionInput,
  ReconciliationRow,
  TokenPair,
  Transaction,
  User,
} from "../types/api";

export const authApi = {
  login: (username: string, password: string) =>
    api.post<TokenPair>("/auth/login/", { username, password }).then((r) => r.data),
};

export const usersApi = {
  me: (userId: number) => api.get<User>(`/users/${userId}/`).then((r) => r.data),
  list: () => api.get<User[]>("/users/").then((r) => r.data),
  registerChild: (payload: { username: string; password: string; email?: string; first_name?: string; last_name?: string }) =>
    api.post<User>("/users/", { ...payload, role: "child" }).then((r) => r.data),
};

export const guardianshipsApi = {
  list: () => api.get<Guardianship[]>("/guardianships/").then((r) => r.data),
};

export const accountsApi = {
  list: () => api.get<Account[]>("/accounts/").then((r) => r.data),
  history: (accountId: number) => api.get<Transaction[]>(`/accounts/${accountId}/history/`).then((r) => r.data),
  reconciliation: (accountId: number) =>
    api.get<ReconciliationRow[]>(`/accounts/${accountId}/reconciliation/`).then((r) => r.data),
};

export const transactionsApi = {
  deposit: (payload: ManualTransactionInput) =>
    api.post<Transaction>("/transactions/deposit/", payload).then((r) => r.data),
  withdraw: (payload: ManualTransactionInput) =>
    api.post<Transaction>("/transactions/withdraw/", payload).then((r) => r.data),
};

export const allowanceRulesApi = {
  list: () => api.get<AllowanceRule[]>("/allowance-rules/").then((r) => r.data),
  create: (payload: AllowanceRuleInput) => api.post<AllowanceRule>("/allowance-rules/", payload).then((r) => r.data),
  update: (id: number, payload: Partial<AllowanceRuleInput>) =>
    api.patch<AllowanceRule>(`/allowance-rules/${id}/`, payload).then((r) => r.data),
};

export const interestRulesApi = {
  list: () => api.get<InterestRule[]>("/interest-rules/").then((r) => r.data),
  create: (payload: InterestRuleInput) => api.post<InterestRule>("/interest-rules/", payload).then((r) => r.data),
  update: (id: number, payload: Partial<InterestRuleInput>) =>
    api.patch<InterestRule>(`/interest-rules/${id}/`, payload).then((r) => r.data),
};
