"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useIsClient, useSession } from "@/lib/session";
import { SplashScreen } from "./splash";

/**
 * Children always render on the server (sidebar + loading skeletons form the
 * static, instantly-navigable shell). On the client, a missing session swaps
 * to the splash and redirects to /login.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const session = useSession();
  const router = useRouter();
  const signedOut = isClient && !session;

  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (signedOut) return <SplashScreen />;
  return <>{children}</>;
}
