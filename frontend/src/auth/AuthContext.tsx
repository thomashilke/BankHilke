import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { useTranslation } from "react-i18next";
import { authApi, usersApi } from "../api/endpoints";
import { apiErrorMessage, onSessionExpired, tokenStore } from "../api/client";
import type { Language, User } from "../types/api";
import i18n, { persistLanguage } from "../i18n";
import { AuthContext, type AuthState } from "./auth-context";

interface AccessTokenClaims {
  user_id: string;
}

async function loadUserFromToken(): Promise<User | null> {
  const access = tokenStore.getAccess();
  if (!access) return null;
  try {
    const { user_id } = jwtDecode<AccessTokenClaims>(access);
    const user = await usersApi.me(Number(user_id));
    // Apply the account's saved UI language preference now that we know it.
    i18n.changeLanguage(user.language);
    persistLanguage(user.language);
    return user;
  } catch {
    tokenStore.clear();
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("checking");

  useEffect(() => {
    loadUserFromToken().then((loaded) => {
      setUser(loaded);
      setStatus(loaded ? "authenticated" : "anonymous");
    });
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      setStatus("anonymous");
    });
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      let tokens;
      try {
        tokens = await authApi.login(username, password);
      } catch (error) {
        throw new Error(apiErrorMessage(error, t("login.invalidCredentials")));
      }
      tokenStore.set(tokens);
      const loaded = await loadUserFromToken();
      if (!loaded) throw new Error(t("login.profileLoadFailed"));
      setUser(loaded);
      setStatus("authenticated");
    },
    [t],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      let tokens;
      try {
        tokens = await authApi.google(credential);
      } catch (error) {
        throw new Error(apiErrorMessage(error, t("login.googleError")));
      }
      tokenStore.set(tokens);
      const loaded = await loadUserFromToken();
      if (!loaded) throw new Error(t("login.profileLoadFailed"));
      setUser(loaded);
      setStatus("authenticated");
    },
    [t],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const updateLanguage = useCallback(
    async (language: Language) => {
      i18n.changeLanguage(language);
      persistLanguage(language);
      if (!user) return;
      const updated = await usersApi.update(user.id, { language });
      setUser(updated);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, status, login, loginWithGoogle, logout, updateLanguage }),
    [user, status, login, loginWithGoogle, logout, updateLanguage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
