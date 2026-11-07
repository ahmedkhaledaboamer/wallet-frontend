/**
 * Demo session: the bearer token + user live in localStorage.
 * PRODUCTION NOTE: a real deployment should keep the token in an httpOnly,
 * Secure, SameSite cookie set by the backend, so page scripts can't read it.
 */
import type { User } from "@/lib/api/schemas";

export interface Session {
  token: string;
  user: User;
}

const KEY = "apx.session";
const listeners = new Set<() => void>();
let cache: Session | null | undefined;

function read(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  if (cache === undefined) cache = read();
  return cache;
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

export function setSession(session: Session | null) {
  cache = session;
  try {
    if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode — keep in memory */
  }
  listeners.forEach((l) => l());
}

export function clearSession() {
  if (getSession()) setSession(null);
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
