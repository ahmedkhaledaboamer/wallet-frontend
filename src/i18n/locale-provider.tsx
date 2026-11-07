"use client";

import { NextIntlClientProvider } from "next-intl";
import { createContext, use, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DirectionProvider } from "@/components/ui/direction";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, dirFor, intlLocale, isLocale, messages, type Locale } from "./config";

interface LocaleContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const listeners = new Set<() => void>();
function readStored(): Locale {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const timeZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Server snapshot is always the default; the client reads localStorage.
  const stored = useSyncExternalStore(subscribe, readStored, () => DEFAULT_LOCALE);
  const [override, setOverride] = useState<Locale | null>(null);
  const locale = override ?? stored;
  const dir = dirFor(locale);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale;
    el.dir = dir;
  }, [locale, dir]);

  const setLocale = useCallback((l: Locale) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    setOverride(l);
    listeners.forEach((fn) => fn());
  }, []);

  const value = useMemo(() => ({ locale, dir, setLocale }), [locale, dir, setLocale]);

  return (
    <LocaleContext value={value}>
      <NextIntlClientProvider locale={intlLocale(locale)} messages={messages[locale]} timeZone={timeZone}>
        <DirectionProvider dir={dir}>{children}</DirectionProvider>
      </NextIntlClientProvider>
    </LocaleContext>
  );
}

export function useLocaleSettings(): LocaleContextValue {
  const ctx = use(LocaleContext);
  if (!ctx) throw new Error("useLocaleSettings must be used inside <LocaleProvider>");
  return ctx;
}
