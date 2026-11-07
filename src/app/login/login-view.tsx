"use client";

import { ArrowRight, ShieldCheck, Users, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { HeroLogo } from "@/components/layout/logo";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { SplashScreen } from "@/components/layout/splash";
import { TestnetBadge } from "@/components/layout/testnet-badge";
import { UserAvatar } from "@/components/layout/user-avatar";
import { ErrorState } from "@/components/common/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoUsers } from "@/lib/api/queries";
import type { DemoUser, Role } from "@/lib/api/schemas";
import { useIsClient, useSession, useSessionActions } from "@/lib/session";

const ROLE_ICON: Record<Role, typeof Users> = { maker: Users, checker: ShieldCheck, executor: Wallet };

export function LoginView() {
  const t = useTranslations();
  const isClient = useIsClient();
  const session = useSession();
  const router = useRouter();
  const { signIn } = useSessionActions();
  const users = useDemoUsers();

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  if (isClient && session) return <SplashScreen />;

  const choose = (u: DemoUser) => {
    signIn(u);
    router.replace("/");
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <section className="dark-surface relative flex flex-col justify-between overflow-hidden bg-sidebar px-6 py-8 text-sidebar-foreground sm:px-10 lg:px-14 lg:py-12">
        <div aria-hidden className="pointer-events-none absolute -top-32 -end-24 size-[28rem] rounded-full bg-brand-gradient opacity-25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -start-32 size-[26rem] rounded-full bg-brand-purple opacity-20 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <TestnetBadge />
          <LocaleToggle tone="dark" />
        </div>
        <div className="relative my-10 lg:my-0">
          <HeroLogo className="w-44 sm:w-56" />
          <h1 className="mt-8 max-w-md font-heading text-2xl leading-tight font-bold text-sidebar-primary sm:text-3xl">
            {t("app.tagline")}
          </h1>
          <p className="mt-3 max-w-md text-sm text-sidebar-foreground sm:text-base">{t("login.footer")}</p>
        </div>
        <p className="relative hidden text-xs text-sidebar-muted-foreground lg:block">© {t("app.company")}</p>
      </section>

      {/* Sign-in */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md animate-fade-up">
          <h2 className="font-heading text-2xl font-bold">{t("login.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("login.subtitle")}</p>

          <div className="mt-8 space-y-3">
            {(users.isLoading || !isClient) &&
              Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[4.5rem] w-full rounded-2xl" />)}
            {users.isError && <ErrorState error={users.error} onRetry={() => void users.refetch()} compact />}
            {users.data?.map((u) => {
              const Icon = ROLE_ICON[u.role];
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => choose(u)}
                  data-testid={`login-${u.role}`}
                  aria-label={t("login.continueAs", { name: `${u.name} (${t(`roles.${u.role}`)})` })}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-start shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised"
                >
                  <UserAvatar name={u.name} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{u.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Icon className="size-3.5 text-primary" aria-hidden />
                      <span className="font-medium text-foreground">{t(`roles.${u.role}`)}</span>
                      <span aria-hidden>·</span>
                      <span className="truncate">{t(`roles.${u.role}Hint`)}</span>
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
