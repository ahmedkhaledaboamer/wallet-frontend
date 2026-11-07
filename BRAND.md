# Apexaora — Batch Payouts brand tokens

All colour values live in **`src/app/globals.css`** (`:root`) and are exposed to Tailwind via `@theme inline`. Components use only token utilities (`bg-primary`, `text-status-failed-fg`, `bg-brand-gradient`…). They contain no hex, rgb or oklch values; `grep` for them in `src/components` returns nothing.

Logo artwork in `public/brand/` comes straight from the client's files (the `*-original.png` files). `npm run brand:assets` derives the trimmed lockups, the mark, the wordmarks, `src/app/icon.png` (favicon) and `src/app/apple-icon.png`.

## Palette

| Token | Value | Use |
|---|---|---|
| `--brand-purple` (= `--primary`) | `#7549AA` | Primary actions, focus ring, active accents |
| `--brand-purple-strong` | `#5F3A8C` | Primary hover/pressed |
| `--brand-purple-secondary` | `#84609E` | Charts/decoration only (fails on dark, see below) |
| `--brand-lavender` | `#C7A8E6` | Text and active state on the dark sidebar |
| `--brand-deep-space` (= `--sidebar`) | `#0C0C1B` | Sidebar, login brand panel |
| `--brand-blue` | `#6699FF` | Decorative only (gradient stop). **Never text on white** |
| `--brand-link` (= `--link`) | `#2F5BD3` | Links on light surfaces |
| `--brand-gradient` | `#7549AA → #6699FF` | Decorative: hero KPI frame, active-nav bar, header rule, glows |
| `--brand-gradient-strong` | `#7549AA → #2F5BD3` | Behind white text ("Pay all" button, avatars). Both stops pass with white |
| `--background` / `--card` | `#F6F6FA` / `#FFFFFF` | Calm light content area |
| `--foreground` / `--muted-foreground` | `#14142B` / `#585870` | Text |
| `--border` / `--input` | `#E4E3EE` / `#D6D4E3` | Hairlines, field borders |
| `--testnet-bg` / `-fg` / `-border` | `#FDEEC4` / `#6E3A06` / `#F0B429` | Always-visible TESTNET / DRY-RUN badge |

### Status colours (tinted bg + darkened fg + dot)

| Status | Tone | bg | fg | dot |
|---|---|---|---|---|
| pending | slate | `#EEF1F5` | `#3B4658` | `#64748B` |
| processing | blue | `#E8EFFF` | `#1D47B0` | `#3B6FE0` |
| succeeded, completed | green | `#E3F5EA` | `#136332` | `#1F9D55` |
| failed, rejected | red | `#FDEAEA` | `#A1221A` | `#DC3B30` |
| requires_reconciliation, completed_with_issues | amber | `#FDF1DC` | `#864204` | `#E08A0B` |
| draft | gray | `#F0F0F3` | `#4B4B5C` | `#8B8B9C` |
| approved | purple | `#F1EAF9` | `#5F3A8C` | `#7549AA` |

Status is never conveyed by colour alone: every badge carries its label, and processing badges also pulse.

## Typography

| Role | Font | Notes |
|---|---|---|
| Headings | **Manrope** (`--font-heading`) | 600–700, slight negative tracking |
| UI + numbers | **Inter** (`--font-sans`, `--font-numeric`) | Numbers use `tabular-nums` |
| Arabic | **IBM Plex Sans Arabic** | Switched in via `:root[lang="ar"]`; Inter still renders Latin and digits |

The `num` utility is applied to amounts, addresses and hashes. It sets Inter with tabular figures, `direction: ltr` and `unicode-bidi: isolate`, so they are always LTR with Western digits, including in Arabic. Arabic `Intl` formatting uses `ar-u-nu-latn` (Latin digits) for counts and dates too. Inside translated sentences, figures are wrapped in Unicode LRI/PDI isolates (`src/lib/bidi.ts`).

## Shape, depth, motion

- Radius: `--radius: 14px` for cards. Buttons and inputs derive 8–10px, pills are full.
- Shadows: `--shadow-card` (resting), `--shadow-raised` (hover / active panels), `--shadow-glow` (purple glow for the hero KPI and the gradient CTA).
- Motion: 150–350 ms ease-out. `fade-up` on page enter, card lift on hover, and striped animated progress while processing. Everything is disabled under `prefers-reduced-motion`.
- Focus: a 2px `--ring` outline with 2px offset on every focusable element, and lavender on dark surfaces.

## Contrast (WCAG 2.1 AA)

Generated from the live tokens by `npm run check:contrast -- --md`. The script exits non-zero if any pair fails, and it is part of `npm run verify`.

| Usage | Foreground | Background | Ratio | Required | Result |
|---|---|---|---:|---:|:---:|
| Body text on page | `--foreground` #14142b | `--background` #f6f6fa | 16.73:1 | 4.5:1 | ✅ |
| Body text on cards | `--foreground` #14142b | `--card` #ffffff | 18.03:1 | 4.5:1 | ✅ |
| Secondary text on page | `--muted-foreground` #585870 | `--background` #f6f6fa | 6.40:1 | 4.5:1 | ✅ |
| Secondary text on cards | `--muted-foreground` #585870 | `--card` #ffffff | 6.90:1 | 4.5:1 | ✅ |
| Secondary text on muted (table header, skeleton rows) | `--muted-foreground` #585870 | `--muted` #f0f0f5 | 6.07:1 | 4.5:1 | ✅ |
| Primary button label | `--primary-foreground` #ffffff | `--primary` #7549aa | 6.38:1 | 4.5:1 | ✅ |
| Primary button hover | `--primary-foreground` #ffffff | `--brand-purple-strong` #5f3a8c | 8.50:1 | 4.5:1 | ✅ |
| Gradient button label (blue stop of --brand-gradient-strong) | `--primary-foreground` #ffffff | `--brand-link` #2f5bd3 | 5.90:1 | 4.5:1 | ✅ |
| Purple text / icons on white | `--primary` #7549aa | `--card` #ffffff | 6.38:1 | 4.5:1 | ✅ |
| Purple text on page | `--primary` #7549aa | `--background` #f6f6fa | 5.92:1 | 4.5:1 | ✅ |
| Secondary button / chips | `--secondary-foreground` #4a2d70 | `--secondary` #f1ecf8 | 9.52:1 | 4.5:1 | ✅ |
| Links on white | `--link` #2f5bd3 | `--card` #ffffff | 5.90:1 | 4.5:1 | ✅ |
| Links on page | `--link` #2f5bd3 | `--background` #f6f6fa | 5.48:1 | 4.5:1 | ✅ |
| Link hover | `--link-hover` #2448ad | `--card` #ffffff | 8.06:1 | 4.5:1 | ✅ |
| Error text on white | `--destructive` #b42318 | `--card` #ffffff | 6.57:1 | 4.5:1 | ✅ |
| Destructive button label | `--destructive-foreground` #ffffff | `--destructive` #b42318 | 6.57:1 | 4.5:1 | ✅ |
| Focus ring on white (non-text 3:1) | `--ring` #7549aa | `--card` #ffffff | 6.38:1 | 3:1 | ✅ |
| Input border (decorative; field also has label) | `--input` #d6d4e3 | `--card` #ffffff | 1.46:1 | 1.2:1 | ✅ |
| Sidebar nav text | `--sidebar-foreground` #b9b6d3 | `--sidebar` #0c0c1b | 9.87:1 | 4.5:1 | ✅ |
| Sidebar captions (role, section labels) | `--sidebar-muted-foreground` #8f8bb0 | `--sidebar` #0c0c1b | 5.98:1 | 4.5:1 | ✅ |
| Sidebar active item | `--sidebar-accent-foreground` #c7a8e6 | `--sidebar-accent` #1c1a33 | 8.17:1 | 4.5:1 | ✅ |
| Lavender on deep space | `--sidebar-primary` #c7a8e6 | `--sidebar` #0c0c1b | 9.38:1 | 4.5:1 | ✅ |
| Sidebar item hover | `--sidebar-foreground` #b9b6d3 | `--sidebar-hover` #15142a | 9.18:1 | 4.5:1 | ✅ |
| Focus ring on sidebar | `--sidebar-ring` #c7a8e6 | `--sidebar` #0c0c1b | 9.38:1 | 3:1 | ✅ |
| Status: pending | `--status-pending-fg` #3b4658 | `--status-pending-bg` #eef1f5 | 8.41:1 | 4.5:1 | ✅ |
| Status: processing | `--status-processing-fg` #1d47b0 | `--status-processing-bg` #e8efff | 7.06:1 | 4.5:1 | ✅ |
| Status: succeeded / completed | `--status-succeeded-fg` #136332 | `--status-succeeded-bg` #e3f5ea | 6.48:1 | 4.5:1 | ✅ |
| Status: failed / rejected | `--status-failed-fg` #a1221a | `--status-failed-bg` #fdeaea | 6.57:1 | 4.5:1 | ✅ |
| Status: requires reconciliation | `--status-reconciliation-fg` #864204 | `--status-reconciliation-bg` #fdf1dc | 6.72:1 | 4.5:1 | ✅ |
| Status: draft | `--status-draft-fg` #4b4b5c | `--status-draft-bg` #f0f0f3 | 7.50:1 | 4.5:1 | ✅ |
| Status: approved | `--status-approved-fg` #5f3a8c | `--status-approved-bg` #f1eaf9 | 7.24:1 | 4.5:1 | ✅ |
| Status text without tint | `--status-processing-fg` #1d47b0 | `--card` #ffffff | 8.14:1 | 4.5:1 | ✅ |
| Status text without tint | `--status-succeeded-fg` #136332 | `--card` #ffffff | 7.35:1 | 4.5:1 | ✅ |
| Status text without tint | `--status-failed-fg` #a1221a | `--card` #ffffff | 7.61:1 | 4.5:1 | ✅ |
| Status text without tint | `--status-reconciliation-fg` #864204 | `--card` #ffffff | 7.51:1 | 4.5:1 | ✅ |
| TESTNET / DRY-RUN badge | `--testnet-fg` #6e3a06 | `--testnet-bg` #fdeec4 | 8.02:1 | 4.5:1 | ✅ |

**Combinations we deliberately don't use:**

- `--brand-blue` on `--card`: 2.78:1 — Logo blue as text on white — use --brand-link instead
- `--brand-purple-secondary` on `--sidebar`: 3.83:1 — Secondary purple on deep space — use --brand-lavender instead
