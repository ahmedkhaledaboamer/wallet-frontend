"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useLocaleSettings } from "@/i18n/locale-provider";
import { LocaleToggle } from "./locale-toggle";
import { LogoMark } from "./logo";
import { RoleSwitcher } from "./role-switcher";
import { SidebarContent } from "./sidebar";
import { TestnetBadge } from "./testnet-badge";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const { dir } = useLocaleSettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:bg-[linear-gradient(to_right,var(--sidebar)_17rem,transparent_17rem)] rtl:lg:bg-[linear-gradient(to_left,var(--sidebar)_17rem,transparent_17rem)]">
      {/* The grid background paints the dark sidebar column full-height, however long the page. */}
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("app.skipToContent")}
      </a>

      <aside className="sticky top-0 z-10 hidden h-dvh overflow-hidden lg:block" aria-label={t("nav.main")}>
        <SidebarContent />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={dir === "rtl" ? "right" : "left"}
          className="w-[17rem] max-w-[85vw] border-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-[17rem]"
          closeLabel={t("nav.closeMenu")}
          data-testid="mobile-drawer"
          // Focus the panel itself rather than the first button (which would pop its tooltip).
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
        >
          <SheetTitle className="sr-only">{t("nav.main")}</SheetTitle>
          <SheetDescription className="sr-only">{t("app.name")}</SheetDescription>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-10">
            <Button
              variant="ghost"
              size="icon"
              className="-ms-1.5 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label={t("nav.openMenu")}
              aria-expanded={open}
              data-testid="open-menu"
            >
              <Menu aria-hidden />
            </Button>
            <Link href="/" className="flex items-center rounded-md lg:hidden" aria-label={t("nav.dashboard")}>
              <LogoMark className="h-5" />
            </Link>
            <TestnetBadge className="hidden sm:inline-flex" />
            <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
              <LocaleToggle />
              <RoleSwitcher />
            </div>
          </div>
          <TestnetBadge variant="strip" className="sm:hidden" />
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
