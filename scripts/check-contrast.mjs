// Verifies WCAG 2.1 contrast for every text/background token pair used by the UI.
// Reads the real values from src/app/globals.css, so BRAND.md can't drift from the code.
// Usage: node scripts/check-contrast.mjs [--md]
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const vars = {};
for (const m of root.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();

function resolve(name, depth = 0) {
  const v = vars[name];
  if (!v) throw new Error(`Unknown token --${name}`);
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  if (ref && depth < 10) return resolve(ref[1], depth + 1);
  if (!/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`--${name} is not a hex colour: ${v}`);
  return v.toLowerCase();
}

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// [foreground token, background token, minimum ratio, usage]
const AA = 4.5;
const LARGE = 3; // ≥ 24px or ≥ 18.66px bold, and non-text UI (focus rings, borders of controls)
const pairs = [
  ["foreground", "background", AA, "Body text on page"],
  ["foreground", "card", AA, "Body text on cards"],
  ["muted-foreground", "background", AA, "Secondary text on page"],
  ["muted-foreground", "card", AA, "Secondary text on cards"],
  ["muted-foreground", "muted", AA, "Secondary text on muted (table header, skeleton rows)"],
  ["primary-foreground", "primary", AA, "Primary button label"],
  ["primary-foreground", "brand-purple-strong", AA, "Primary button hover"],
  ["primary-foreground", "brand-link", AA, "Gradient button label (blue stop of --brand-gradient-strong)"],
  ["primary", "card", AA, "Purple text / icons on white"],
  ["primary", "background", AA, "Purple text on page"],
  ["secondary-foreground", "secondary", AA, "Secondary button / chips"],
  ["link", "card", AA, "Links on white"],
  ["link", "background", AA, "Links on page"],
  ["link-hover", "card", AA, "Link hover"],
  ["destructive", "card", AA, "Error text on white"],
  ["destructive-foreground", "destructive", AA, "Destructive button label"],
  ["ring", "card", LARGE, "Focus ring on white (non-text 3:1)"],
  ["input", "card", 1.2, "Input border (decorative; field also has label)"],
  ["sidebar-foreground", "sidebar", AA, "Sidebar nav text"],
  ["sidebar-muted-foreground", "sidebar", AA, "Sidebar captions (role, section labels)"],
  ["sidebar-accent-foreground", "sidebar-accent", AA, "Sidebar active item"],
  ["sidebar-primary", "sidebar", AA, "Lavender on deep space"],
  ["sidebar-foreground", "sidebar-hover", AA, "Sidebar item hover"],
  ["sidebar-ring", "sidebar", LARGE, "Focus ring on sidebar"],
  ["status-pending-fg", "status-pending-bg", AA, "Status: pending"],
  ["status-processing-fg", "status-processing-bg", AA, "Status: processing"],
  ["status-succeeded-fg", "status-succeeded-bg", AA, "Status: succeeded / completed"],
  ["status-failed-fg", "status-failed-bg", AA, "Status: failed / rejected"],
  ["status-reconciliation-fg", "status-reconciliation-bg", AA, "Status: requires reconciliation"],
  ["status-draft-fg", "status-draft-bg", AA, "Status: draft"],
  ["status-approved-fg", "status-approved-bg", AA, "Status: approved"],
  ["status-processing-fg", "card", AA, "Status text without tint"],
  ["status-succeeded-fg", "card", AA, "Status text without tint"],
  ["status-failed-fg", "card", AA, "Status text without tint"],
  ["status-reconciliation-fg", "card", AA, "Status text without tint"],
  ["testnet-fg", "testnet-bg", AA, "TESTNET / DRY-RUN badge"],
];

// Documented failures we deliberately avoid (shown in BRAND.md, not enforced).
const rejected = [
  ["brand-blue", "card", "Logo blue as text on white — use --brand-link instead"],
  ["brand-purple-secondary", "sidebar", "Secondary purple on deep space — use --brand-lavender instead"],
];

let failed = 0;
const rows = pairs.map(([fg, bg, min, use]) => {
  const r = ratio(resolve(fg), resolve(bg));
  const ok = r >= min;
  if (!ok) failed++;
  return { fg, bg, fgHex: resolve(fg), bgHex: resolve(bg), r, min, ok, use };
});

if (process.argv.includes("--md")) {
  console.log("| Usage | Foreground | Background | Ratio | Required | Result |");
  console.log("|---|---|---|---:|---:|:---:|");
  for (const x of rows)
    console.log(`| ${x.use} | \`--${x.fg}\` ${x.fgHex} | \`--${x.bg}\` ${x.bgHex} | ${x.r.toFixed(2)}:1 | ${x.min}:1 | ${x.ok ? "✅" : "❌"} |`);
  console.log("\n**Combinations we deliberately don't use:**\n");
  for (const [fg, bg, why] of rejected)
    console.log(`- \`--${fg}\` on \`--${bg}\`: ${ratio(resolve(fg), resolve(bg)).toFixed(2)}:1 — ${why}`);
} else {
  for (const x of rows)
    console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.r.toFixed(2).padStart(5)}:1 (min ${x.min})  --${x.fg} on --${x.bg}  — ${x.use}`);
  for (const [fg, bg, why] of rejected)
    console.log(`AVOID ${ratio(resolve(fg), resolve(bg)).toFixed(2).padStart(5)}:1  --${fg} on --${bg}  — ${why}`);
  console.log(failed ? `\n${failed} pair(s) fail WCAG AA` : `\nAll ${rows.length} pairs pass`);
}
process.exit(failed ? 1 : 0);
