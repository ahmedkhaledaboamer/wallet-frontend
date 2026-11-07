# Apexaora: One-Click Batch Crypto Payouts (frontend)

Accounts uploads an Excel withdrawal list, a **checker** approves it, and an **executor** pays the whole list with one click. Payment goes through either **MEXC** (server-side) or **Trust Wallet** (the browser signs one transaction, and the private key never leaves the wallet). **Testnet only.**

Next.js 16 (App Router, Cache Components) · TypeScript strict · Tailwind CSS v4 · shadcn/ui (Radix, themed) · TanStack Query · zod · react-hook-form · sonner · viem + WalletConnect (Reown) · next-intl (EN / AR, full RTL) · vitest · Playwright.

## Quick start

```bash
npm install
cp .env.example .env.local     # defaults to mock mode, no backend needed
npm run dev                    # http://localhost:3000
```

Pick a demo user on the sign-in screen. The **Demo** role switcher in the top bar changes role at any time.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js on port 3000 |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint (Next + React Compiler rules) |
| `npm test` | vitest unit tests |
| `npm run test:e2e` | Playwright e2e in mock mode, against `next start -p 3300` (run `npm run build` first) |
| `npm run screenshots` | Every page × desktop 1440 / mobile 390 × EN / AR, saved to `screens/` |
| `npm run check:contrast` | WCAG AA check of every token pair in `globals.css` |
| `npm run fixtures` | Regenerates the `.xlsx` e2e fixtures (exceljs) |
| `npm run verify` | typecheck → lint → contrast → unit tests → build |
| `npm run contract:check` | **Live:** calls the running backend and parses every response with the zod schemas |
| `npm run test:e2e:live` | **Live:** Playwright (1 worker, headless) against the running stack (`../start-all.ps1`): sign-in, translated row errors, four-eyes, Pay all + 409, -FAIL/-RECON, Trust Wallet with simulated verification, dashboard/audit |

## Environment

| Variable | Default | |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | NestJS backend base URL |
| `NEXT_PUBLIC_API_MODE` | `mock` | `mock` = in-browser backend, `live` = real API. **No UI changes between them** |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | *(empty)* | Enables the WalletConnect QR fallback. When empty, the QR button is hidden and a short note explains why. Trust Wallet's in-app browser and extension still work |

## Architecture

```
src/lib/api/
  schemas.ts      zod mirror of the API CONTRACT; every response is parsed here
  client.ts       one typed method per endpoint; errors → ApiError(kind: unauthorized|forbidden|conflict|validation|…)
  transport.ts    fetch transport (live)
  mock/           in-memory backend behind the SAME Transport interface
  queries.ts      TanStack Query hooks (3s polling while a batch is processing)
src/lib/wallet/
  machine.ts      pure state machine for the Trust Wallet stepper (unit-tested)
  use-trust-wallet-flow.ts   viem steps: connect → network/balance → approve → simulate → sign → report → verify
  payload.ts      verifies the on-chain payload against the approved batch before signing
src/lib/amount.ts BigInt-safe decimal helpers; amounts are never JS numbers
src/components/   layout · common · dashboard · batches · payout · audit · wallet
messages/         en.json / ar.json (parity enforced by a unit test)
```

Mock and live share everything except the transport. Mock responses go through the same zod validation and error mapping as live ones, so switching `NEXT_PUBLIC_API_MODE` changes nothing else.

## Contract additions used from the real backend

- **Row errors** carry `issues: [{ code, params }]` next to `messages`. The errors table translates each code (`messages/*.json → issues`) and falls back to the server text for unknown codes. Inserted values are wrapped in LTR isolates so Arabic lines read correctly.
- **`Batch.simulated`** (dry-run verification): shows a **Simulated** badge on the batch.
- **`GET /config` → `maxRowsByChannel`**: the upload hint shows the selected channel's limit (MEXC 1000, Trust Wallet 200).

The mock backend emits the same shapes.

## Mock mode

- **Seed data** is deterministic. It covers 12 batches across every status and both channels, for example `PO-1011` (MEXC draft), `PO-1009` (MEXC approved), `PO-1010` (Trust Wallet approved) and `PO-1003` (completed with issues).
- **Processing advances over time.** For MEXC, each withdrawal goes pending → processing → final, and the whole batch takes about 9s at most. For Trust Wallet, the backend "confirms on-chain" about 6s after `POST /transaction`.
- **Controlling outcomes from the Excel file:** a reference ending in `-FAIL` makes that MEXC withdrawal fail, and `-RECON` makes it `requires_reconciliation`. See `e2e/fixtures/mexc-with-issues.xlsx`.
- **Validation** checks headers, required fields, duplicate references, the address format per network, positive amounts with at most 6 decimals, a single asset and a single network per file, Trust Wallet = BEP20/ERC20 only, `maxRows` and `maxBatchTotal`. Excel row numbers are reported, with `row: 0` for file-level problems.
- **Policies:** roles (403), illegal transitions (409), and four-eyes (the maker can't approve their own batch).
- **State persistence:** state is kept in `sessionStorage`, so a reload keeps progress. A new tab starts from the seed.

## Safety measures in the Trust Wallet flow

1. **Payload verification before anything is signed.** The recipient count, the sum of amounts, the total and the chain must match the batch the checker approved. If they don't, the flow refuses to sign (`payloadMismatch`).
2. **Treasury check.** The connected account must equal `payload.treasury`.
3. **Exact approval.** `approve(contract, total)` is sent only if the current allowance is too low, and never with `maxUint256`.
4. **Simulation.** `simulateContract` runs before `writeContract`, and revert reasons are shown in plain language.
5. **No double payment.** Once the payout tx hash exists, the state machine can't return to a sending step. The hash is also stored per batch in `localStorage`, so a reload or a failed `POST /transaction` resumes in "Verifying" with **Retry reporting** instead of offering to pay again.
6. **Plain-language errors** for: user rejected, wrong account, wrong network or switch failed, insufficient token balance, no gas, simulation revert, tx reverted, and backend reporting failure.

## Backend contract alignment (confirmed)

- **Payout contract:** `payout(bytes32 batchRef, IERC20 token, address[] recipients, uint256[] amounts)`, with batchRef first. Event: `BatchPaid(bytes32 indexed batchRef, address indexed token, address indexed payer, uint256 total, uint256 count)` (`src/lib/wallet/abi.ts`).
- **`/onchain-payload` `amounts[]` and `total` are raw token base units** (integer strings, already × 10^tokenDecimals). They go to the contract as `BigInt` unchanged and are never re-scaled in the browser. `tokenDecimals` is used only for display and for the pre-sign check, which converts base units back to a decimal and compares count, total and network with the approved batch. The zod schema rejects decimal strings here.
- **`batchRef`** is used as-is when it is 32-byte hex, otherwise as `keccak256(utf8(batchRef))`.
- **Row errors:** `row` is the Excel row number (header = 1), and `row: 0` means the problem is with the whole file.
- **Still assumed (not covered by the contract):** optional fields may be `null` or omitted. Error `code` is optional, and NestJS-style `message: string[]` is accepted.
- **Audit action names** the UI translates: `batch.created|approved|rejected|execution_started|transaction_submitted|completed|completed_with_issues|failed` and `item.failed|requires_reconciliation`. Unknown actions fall back to a readable form.

## Security notes

- **Demo auth only.** The bearer token sits in `localStorage` to keep the demo simple. **Production should use an httpOnly, Secure, SameSite cookie** set by the backend, so page scripts (and any XSS) can't read the token.
- Explorer links from the API are rendered only if they are `http(s)` (`safeHref`).
- **Dependencies:** SheetJS (`xlsx`) is deliberately not used (it's outdated and has known vulnerabilities), so exceljs handles the mock template and the fixtures. `package.json` `overrides` pin `zod ^4.6.6` (DoS advisory in zod 3, pulled in by Reown's embedded-wallet schemas, which this app never uses) and `uuid ^11.1.1` (advisory in exceljs's `uuid` 8). The `shadcn` CLI is a dev dependency, because only its stylesheet is compiled in at build time. `npm audit --omit=dev` reports **0 vulnerabilities**. The remaining full-audit findings are low or moderate issues in dev tooling only (`minimatch` and `deepmerge` via `eslint-config-next` and the shadcn CLI), and none of that code ships to the browser.

## Accessibility & i18n

- WCAG AA contrast for every text token pair, verified by a script (see `BRAND.md`).
- Visible focus rings, a skip link, native radio cards for channel selection, `aria-live` validation and stepper updates, labelled icon buttons, and progress bars with `aria-valuenow`.
- Full RTL with logical properties: the drawer opens from the right in Arabic and directional icons mirror. Amounts, addresses and hashes are always LTR with Western digits, and dates use the Latin numbering system.
- Server-provided validation messages are shown verbatim (the backend owns that copy).

## Tests

- **Unit (69, vitest):** amount formatting and BigInt maths, contract schemas, client error mapping, the wallet state machine (including never re-paying), payload verification, the mock backend's transitions, and EN/AR key and placeholder parity.
- **E2E (7, Playwright, mock mode):**
  - The full MEXC flow: invalid file → errors table → valid file → approve → pay → completed.
  - Reject with a reason.
  - A batch that ends completed with issues.
  - Trust Wallet with a mocked EIP-1193 provider: chain switch, exactly one exact-amount approval, a rejected signature then retry → done, and the signed `payout` calldata decoded and checked (batchRef first, base units unchanged).
  - Wrong account blocked.
  - Insufficient balance.
  - QR fallback hidden without a project ID.
