"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { AuthResponseDto, AuthUserDto } from "shared";
import { API_URL } from "./api";
import { clearGuestCartId, getOrCreateGuestCartId } from "./guest-cart";

type AuthState = {
  user: AuthUserDto | null;
  accessToken: string | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "tech-hub.auth";

const EMPTY_STATE: AuthState = { user: null, accessToken: null };

function readStoredAuth(): AuthState {
  if (typeof window === "undefined") return EMPTY_STATE;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : EMPTY_STATE;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readStoredAuth);

  function persist(next: AuthResponseDto) {
    setState({ user: next.user, accessToken: next.accessToken });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // The api just merged whatever was in it into the real cart —
    // nothing left to track anonymously until the shopper logs out.
    clearGuestCartId();
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Guest-Cart-Id": getOrCreateGuestCartId() },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Invalid email or password");
    persist((await res.json()) as AuthResponseDto);
  }

  async function register(email: string, password: string, name?: string) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Guest-Cart-Id": getOrCreateGuestCartId() },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) throw new Error((await res.json()).message ?? "Could not create account");
    persist((await res.json()) as AuthResponseDto);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, accessToken: null });
  }

  // NB: a production build should retry once on 401 using the refresh
  // token before giving up — left as a follow-up so this stays readable.
  function authFetch(path: string, init: RequestInit = {}) {
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(state.accessToken
          ? { Authorization: `Bearer ${state.accessToken}` }
          : { "X-Guest-Cart-Id": getOrCreateGuestCartId() }),
      },
    });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
