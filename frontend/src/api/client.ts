import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { TokenPair } from "../types/api";

const ACCESS_KEY = "hilkebank.access";
const REFRESH_KEY = "hilkebank.refresh";

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (tokens: TokenPair) => {
    localStorage.setItem(ACCESS_KEY, tokens.access);
    localStorage.setItem(REFRESH_KEY, tokens.refresh);
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS_KEY, access),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// Vite dev server proxies /api -> the Django backend (see vite.config.ts);
// in production this is expected to be served from the same origin behind
// a reverse proxy, but VITE_API_BASE_URL can override it.
const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const api = axios.create({ baseURL });

let sessionExpiredHandler: (() => void) | null = null;
export function onSessionExpired(handler: () => void) {
  sessionExpiredHandler = handler;
}

api.interceptors.request.use((config) => {
  const access = tokenStore.getAccess();
  if (access) {
    config.headers.set("Authorization", `Bearer ${access}`);
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const { data } = await axios.post<{ access: string }>(`${baseURL}/auth/refresh/`, { refresh });
    tokenStore.setAccess(data.access);
    return data.access;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response?.status !== 401 || !original || original._retried || original.url?.includes("/auth/")) {
      throw error;
    }

    original._retried = true;
    refreshInFlight ??= refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
    const newAccess = await refreshInFlight;

    if (!newAccess) {
      tokenStore.clear();
      sessionExpiredHandler?.();
      throw error;
    }

    original.headers.set("Authorization", `Bearer ${newAccess}`);
    return api.request(original);
  },
);

/** Extracts a human-readable message from a DRF error response. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      if ("detail" in data && typeof data.detail === "string") return data.detail;
      const firstEntry = Object.entries(data as Record<string, unknown>)[0];
      if (firstEntry) {
        const [field, messages] = firstEntry;
        const message = Array.isArray(messages) ? messages[0] : String(messages);
        return field === "non_field_errors" || field === "detail" ? String(message) : `${field}: ${message}`;
      }
    }
    if (error.message) return error.message;
  }
  return fallback;
}
