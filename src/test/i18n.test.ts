import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("translations", () => {
  it("Arabic covers every English key and vice versa", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it("no translation is empty", () => {
    for (const [lang, msgs] of Object.entries({ en, ar })) {
      for (const k of keys(msgs)) {
        const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], msgs);
        expect(typeof v === "string" && v.trim().length > 0, `${lang}:${k}`).toBe(true);
      }
    }
  });

  it("keeps the same placeholders in both languages", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
    for (const k of keys(en)) {
      const get = (m: object) => k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], m) as string;
      expect(new Set(ph(get(ar))), k).toEqual(new Set(ph(get(en))));
    }
  });
});
