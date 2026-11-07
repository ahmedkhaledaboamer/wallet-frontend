import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "apx.locale";

export const messages = { en, ar } as const;
export type Messages = typeof en;

export const dirFor = (locale: Locale): "ltr" | "rtl" => (locale === "ar" ? "rtl" : "ltr");

/**
 * BCP-47 tag handed to Intl / next-intl. Arabic uses the Latin numbering system
 * so every figure on screen (amounts, counts, dates) uses Western digits.
 */
export const intlLocale = (locale: Locale) => (locale === "ar" ? "ar-u-nu-latn" : "en-GB");

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "ar";
}

/**
 * Inline script for <head>: applies the saved locale's lang/dir before first
 * paint, so Arabic users never see an LTR flash (keeps the shell static).
 */
export const localeBootScript = `(function(){try{var l=localStorage.getItem(${JSON.stringify(
  LOCALE_STORAGE_KEY,
)});if(l==="ar"){var d=document.documentElement;d.lang="ar";d.dir="rtl";}}catch(e){}})();`;
