import { createContext } from "react";
import type { Language, User } from "../types/api";

export interface AuthState {
  user: User | null;
  status: "checking" | "authenticated" | "anonymous";
  login: (username: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
  updateLanguage: (language: Language) => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
