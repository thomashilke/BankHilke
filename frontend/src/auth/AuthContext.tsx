import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { authApi, usersApi } from "../api/endpoints";
import { apiErrorMessage, onSessionExpired, tokenStore } from "../api/client";
import type { User } from "../types/api";
import { AuthContext, type AuthState } from "./auth-context";

interface AccessTokenClaims {
  user_id: string;
}

async function loadUserFromToken(): Promise<User | null> {
  const access = tokenStore.getAccess();
  if (!access) return null;
  try {
    const { user_id } = jwtDecode<AccessTokenClaims>(access);
    return await usersApi.me(Number(user_id));
  } catch {
    tokenStore.clear();
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
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

  const login = useCallback(async (username: string, password: string) => {
    let tokens;
    try {
      tokens = await authApi.login(username, password);
    } catch (error) {
      throw new Error(apiErrorMessage(error, "Invalid username or password."));
    }
    tokenStore.set(tokens);
    const loaded = await loadUserFromToken();
    if (!loaded) throw new Error("Signed in, but could not load your profile.");
    setUser(loaded);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
