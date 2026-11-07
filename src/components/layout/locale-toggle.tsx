"use client";

import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useLocaleSettings } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function LocaleToggle({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const t = useTranslations("locale");
  const { locale, setLocale } = useLocaleSettings();
  const next = locale === "en" ? "ar" : "en";
  return (
    <Button
      variant="ghost"
      onClick={() => setLocale(next)}
      aria-label={t("switchLabel")}
      lang={next}
      data-testid="locale-toggle"
      className={cn(
        "gap-1.5 px-2.5 font-medium",
        tone === "dark" && "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-primary",
        className,
      )}
    >
      <Languages aria-hidden />
      <span className={cn(next === "ar" && "font-[family-name:var(--font-plex-arabic)]")}>{t("switchTo")}</span>
    </Button>
  );
}
