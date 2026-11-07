"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { DemoUser } from "@/lib/api/schemas";
import { getSession, setSession, subscribeSession, type Session } from "@/lib/session-store";

const noopSubscribe = () => () => {};

/** true only after hydration — gates anything that depends on localStorage. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession, () => null);
}

export function useSessionActions() {
  const qc = useQueryClient();

  const signIn = useCallback(
    (u: DemoUser) => {
      setSession({ token: u.token, user: { id: u.id, name: u.name, role: u.role } });
      // Same data, different permissions: refetch everything under the new token.
      void qc.invalidateQueries();
    },
    [qc],
  );

  const signOut = useCallback(() => {
    setSession(null);
    qc.clear();
  }, [qc]);

  return { signIn, signOut };
}
