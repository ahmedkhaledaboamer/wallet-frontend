/**
 * Contract check: calls the RUNNING backend and parses every response with the frontend's zod schemas.
 *   npx tsx e2e/live/contract-check.ts [http://localhost:4000/api]
 */
import type { z } from "zod";
import * as S from "../../src/lib/api/schemas";
import { invalidRows, runTag, sheet, trustRows } from "./sheets";

const BASE = process.argv[2] ?? "http://localhost:4000/api";
let failures = 0;

async function call(method: string, path: string, token?: string, body?: FormData | object) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  return { status: res.status, json: text ? (JSON.parse(text) as unknown) : undefined };
}

function check<Sc extends z.ZodType>(label: string, schema: Sc, value: unknown, extra?: (v: z.output<Sc>) => string | null): z.output<Sc> | undefined {
  const r = schema.safeParse(value);
  const problem = r.success ? (extra?.(r.data) ?? null) : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  if (problem) failures++;
  console.log(`${problem ? "FAIL" : "ok  "}  ${label}${problem ? `  -> ${problem}` : ""}`);
  return r.success ? r.data : undefined;
}

async function form(rows: Parameters<typeof sheet>[0], channel: string) {
  const f = new FormData();
  f.append("channel", channel);
  f.append("file", new Blob([new Uint8Array(await sheet(rows))]), "check.xlsx");
  return f;
}

async function main() {
  const cfg = await call("GET", "/config");
  check("GET /config", S.configSchema, cfg.json, (c) => (c.maxRowsByChannel?.trust_wallet === 200 ? null : "maxRowsByChannel missing"));
  const users = check("GET /demo/users", S.demoUsersSchema, (await call("GET", "/demo/users")).json)!;
  const tok = (role: S.Role) => users.find((u) => u.role === role)!.token;
  const [maker, checker, executor] = [tok("maker"), tok("checker"), tok("executor")];

  check("GET /me", S.userSchema, (await call("GET", "/me", maker)).json);
  check("GET /dashboard/stats", S.dashboardStatsSchema, (await call("GET", "/dashboard/stats", maker)).json);
  const list = check("GET /batches", S.pageSchema(S.batchSchema), (await call("GET", "/batches?pageSize=100", maker)).json)!;
  const one = list.data[0]!;
  check("GET /batches/:id", S.batchSchema, (await call("GET", `/batches/${one.id}`, maker)).json);
  check("GET /batches/:id/items", S.pageSchema(S.batchItemSchema), (await call("GET", `/batches/${one.id}/items`, maker)).json);
  check("GET /batches/:id/audit", S.auditEntrySchema.array(), (await call("GET", `/batches/${one.id}/audit`, maker)).json);
  check("GET /audit", S.pageSchema(S.auditEntrySchema), (await call("GET", "/audit?pageSize=200", maker)).json);
  check("Batch.simulated parsed", S.batchSchema.array(), list.data, (b) => (b.some((x) => x.simulated) ? null : "no simulated batch found"));

  const tag = runTag();
  const v = await call("POST", "/batches/validate", maker, await form(invalidRows(tag), "mexc"));
  check("POST /batches/validate (invalid) has issue codes", S.validationResultSchema, v.json, (r) =>
    !r.valid && r.errors.length === 5 && r.errors.every((e) => e.issues.length === e.messages.length && e.issues.length > 0)
      ? null
      : `issues missing or misaligned: ${JSON.stringify(r.errors.map((e) => [e.row, e.issues.map((i) => i.code)]))}`,
  );
  const bad = await call("POST", "/batches", maker, await form(invalidRows(tag), "mexc"));
  check("POST /batches invalid -> 422 error body", S.apiErrorBodySchema, bad.json, (b) =>
    bad.status === 422 && b.code === "VALIDATION_FAILED" && b.errors?.length ? null : `status ${bad.status}`,
  );
  const forbidden = await call("POST", `/batches/${one.id}/approve`, maker);
  check("403 error body", S.apiErrorBodySchema, forbidden.json, (b) => (forbidden.status === 403 && b.code === "FORBIDDEN_ROLE" ? null : `status ${forbidden.status}`));

  const created = await call("POST", "/batches", maker, await form(trustRows(tag, ["250.00", "0.5", "1200.123456"]), "trust_wallet"));
  const tw = check("POST /batches (trust_wallet) -> 201 Batch", S.batchSchema, created.json, () => (created.status === 201 ? null : `status ${created.status}`))!;
  await call("POST", `/batches/${tw.id}/approve`, checker);
  const p = check("GET /onchain-payload -> base units", S.onchainPayloadSchema, (await call("GET", `/batches/${tw.id}/onchain-payload`, executor)).json, (x) =>
    x.total === "1450623456" && x.amounts.join() === "250000000,500000,1200123456" && x.batchRef === `0x${tw.id.replace(/-/g, "")}${"0".repeat(32)}`
      ? null
      : `unexpected ${x.total} ${x.amounts.join()} ${x.batchRef}`,
  );
  if (p) console.log(`      chainId=${p.chainId} decimals=${p.tokenDecimals} treasury=${p.treasury}`);
  console.log(failures ? `\n${failures} contract check(s) FAILED` : "\nAll contract checks passed");
  process.exit(failures ? 1 : 0);
}

void main();
