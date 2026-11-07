"use client";

import { Layers, LayoutDashboard, LogOut, ScrollText, UploadCloud, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession, useSessionActions } from "@/lib/session";
import { cn } from "@/lib/utils";
import { SidebarLogo } from "./logo";
import { UserAvatar } from "./user-avatar";

interface NavItem {
  href: "/" | "/batches" | "/payouts/new" | "/audit";
  key: "dashboard" | "batches" | "newPayout" | "audit";
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/batches", key: "batches", icon: Layers },
  { href: "/payouts/new", key: "newPayout", icon: UploadCloud },
  { href: "/audit", key: "audit", icon: ScrollText },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const t = useTranslations();
  return (
    <ul className="space-y-1">
      {NAV.map(({ href, key, icon: Icon }) => {
        const active = pathname !== null && isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              data-testid={`nav-${key}`}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-primary",
              )}
            >
              {active && (
                <span aria-hidden className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-brand-gradient" />
              )}
              <Icon className={cn("size-[1.125rem] shrink-0", active ? "text-sidebar-primary" : "opacity-80")} aria-hidden />
              {t(`nav.${key}`)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations();
  const session = useSession();
  const { signOut } = useSessionActions();

  return (
    <div className="dark-surface relative flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Decorative brand glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-brand-gradient opacity-[0.07] blur-2xl" />

      <div className="relative px-5 pt-6 pb-5">
        <Link href="/" onClick={onNavigate} className="inline-flex rounded-md" aria-label={t("nav.dashboard")}>
          <SidebarLogo />
        </Link>
        <p className="mt-3 text-[0.6875rem] font-semibold tracking-[0.14em] text-sidebar-muted-foreground uppercase">
          {t("app.name")}
        </p>
      </div>

      <nav aria-label={t("nav.main")} className="relative flex-1 px-3">
        {/* usePathname() is request data on dynamic routes: keep it inside Suspense so the shell stays static. */}
        <Suspense fallback={<NavLinks pathname={null} onNavigate={onNavigate} />}>
          <ActiveNavLinks onNavigate={onNavigate} />
        </Suspense>
      </nav>

      {session && (
        <div className="relative m-3 flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar-hover p-3">
          <UserAvatar name={session.user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-primary" data-testid="current-user">
              {session.user.name}
            </p>
            <p className="truncate text-xs text-sidebar-muted-foreground" data-testid="current-role">
              {t(`roles.${session.user.role}`)}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={signOut}
                aria-label={t("nav.signOut")}
                className="flex size-8 items-center justify-center rounded-lg text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary"
              >
                <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("nav.signOut")}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
