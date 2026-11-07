/**
 * Zod schemas for every API response — a 1:1 mirror of the shared API CONTRACT.
 * Every response (live or mock) is parsed through these before reaching the UI.
 *
 * Optional contract fields (`approvedBy?`) also accept `null`, since many
 * serializers emit null for absent values; both normalize to `undefined`.
 */
import { z } from "zod";

// ── Primitives ────────────────────────────────────────────────────────────────

/** Decimal amount transported as a string, e.g. "1250.50". Never a JS number. */
export const amountSchema = z.string().regex(/^\d+(\.\d+)?$/, "Expected a decimal string");

export const isoDateSchema = z.iso.datetime({ offset: true });

const opt = <T extends z.ZodType>(schema: T) =>
  schema
    .nullable()
    .transform((v): z.output<T> | undefined => v ?? undefined)
    .optional();

const id = z.union([z.string().min(1), z.number().int().transform(String)]);

// ── Enums ─────────────────────────────────────────────────────────────────────

export const ROLES = ["maker", "checker", "executor"] as const;
export const CHANNELS = ["mexc", "trust_wallet"] as const;
export const NETWORKS = ["TRC20", "BEP20", "ERC20"] as const;
export const BATCH_STATUSES = [
  "draft",
  "approved",
  "rejected",
  "processing",
  "completed",
  "completed_with_issues",
  "failed",
] as const;
export const ITEM_STATUSES = ["pending", "processing", "succeeded", "failed", "requires_reconciliation"] as const;

export const roleSchema = z.enum(ROLES);
export const channelSchema = z.enum(CHANNELS);
export const networkSchema = z.enum(NETWORKS);
export const batchStatusSchema = z.enum(BATCH_STATUSES);
export const itemStatusSchema = z.enum(ITEM_STATUSES);

export type Role = z.infer<typeof roleSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type Network = z.infer<typeof networkSchema>;
export type BatchStatus = z.infer<typeof batchStatusSchema>;
export type ItemStatus = z.infer<typeof itemStatusSchema>;

/** Batch statuses after which nothing changes any more. */
export const FINAL_BATCH_STATUSES: readonly BatchStatus[] = ["rejected", "completed", "completed_with_issues", "failed"];

// ── Entities ──────────────────────────────────────────────────────────────────

export const userSchema = z.object({
  id,
  name: z.string(),
  role: roleSchema,
});
export type User = z.output<typeof userSchema>;

export const batchSchema = z.object({
  id,
  channel: channelSchema,
  status: batchStatusSchema,
  asset: z.string(),
  network: networkSchema,
  totalAmount: amountSchema,
  itemCount: z.number().int().nonnegative(),
  paidCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  reconciliationCount: z.number().int().nonnegative(),
  createdBy: userSchema,
  approvedBy: opt(userSchema),
  executedBy: opt(userSchema),
  rejectionReason: opt(z.string()),
  txHash: opt(z.string()),
  explorerUrl: opt(z.string()),
  createdAt: isoDateSchema,
  approvedAt: opt(isoDateSchema),
  executedAt: opt(isoDateSchema),
  completedAt: opt(isoDateSchema),
  /** true when a dry-run simulator (not a real chain) settled the batch. */
  simulated: z.boolean().optional().default(false),
});
export type Batch = z.output<typeof batchSchema>;

export const batchItemSchema = z.object({
  id,
  reference: z.string(),
  address: z.string(),
  amount: amountSchema,
  memo: opt(z.string()),
  status: itemStatusSchema,
  providerReference: opt(z.string()),
  failureReason: opt(z.string()),
  explorerUrl: opt(z.string()),
  processedAt: opt(isoDateSchema),
});
export type BatchItem = z.output<typeof batchItemSchema>;

export const auditEntrySchema = z.object({
  id,
  batchId: id,
  action: z.string(),
  actor: opt(userSchema),
  context: z.record(z.string(), z.unknown()).nullish().transform((v) => v ?? {}),
  createdAt: isoDateSchema,
});
export type AuditEntry = z.output<typeof auditEntrySchema>;

export const pageMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export type PageMeta = z.output<typeof pageMetaSchema>;

export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), meta: pageMetaSchema });
export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

// ── Endpoint responses ────────────────────────────────────────────────────────

export const networkConfigSchema = z.object({
  network: networkSchema,
  chainId: opt(z.number().int().positive()),
  name: z.string(),
  explorerUrl: z.string(),
});
export type NetworkConfig = z.output<typeof networkConfigSchema>;

export const configSchema = z.object({
  environment: z.literal("testnet"),
  dryRun: z.boolean(),
  networks: z.array(networkConfigSchema),
  maxRows: z.number().int().positive(),
  /** Per-channel row limits (MEXC 1000, Trust Wallet 200). Optional for older backends. */
  maxRowsByChannel: z.object({ mexc: z.number().int().positive(), trust_wallet: z.number().int().positive() }).optional(),
  maxBatchTotal: amountSchema,
});
export type AppConfig = z.output<typeof configSchema>;

export const demoUserSchema = userSchema.extend({ token: z.string().min(1) });
export type DemoUser = z.output<typeof demoUserSchema>;
export const demoUsersSchema = z.array(demoUserSchema);

export const dashboardStatsSchema = z.object({
  totalPaid: amountSchema,
  pendingApprovalCount: z.number().int().nonnegative(),
  processingCount: z.number().int().nonnegative(),
  needsReconciliationCount: z.number().int().nonnegative(),
  byChannel: z.array(
    z.object({
      channel: channelSchema,
      totalPaid: amountSchema,
      batchCount: z.number().int().nonnegative(),
    }),
  ),
});
export type DashboardStats = z.output<typeof dashboardStatsSchema>;

/** Stable, translatable validation issue (e.g. { code: "reference.duplicate", params: { reference, firstRow } }). */
export const issueSchema = z.object({
  code: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])).optional(),
});
export type Issue = z.output<typeof issueSchema>;

export const rowErrorSchema = z.object({
  row: z.number().int().nonnegative(),
  /** English text; messages[i] describes issues[i]. */
  messages: z.array(z.string()),
  issues: z.array(issueSchema).optional().default([]),
});
export type RowError = z.output<typeof rowErrorSchema>;

export const validationResultSchema = z.object({
  valid: z.boolean(),
  rowCount: z.number().int().nonnegative(),
  totalAmount: amountSchema,
  asset: opt(z.string()),
  network: opt(networkSchema),
  errors: z.array(rowErrorSchema),
});
export type ValidationResult = z.output<typeof validationResultSchema>;

/** Raw token base units: a non-negative integer string (already × 10^tokenDecimals). */
export const baseUnitsSchema = z.string().regex(/^\d+$/, "Expected an integer base-unit string");

const hexAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Expected a 0x address")
  .transform((v) => v as `0x${string}`);

export const onchainPayloadSchema = z
  .object({
    chainId: z.number().int().positive(),
    contract: hexAddress,
    token: hexAddress,
    tokenDecimals: z.number().int().min(0).max(36),
    treasury: hexAddress,
    batchRef: z.string().min(1),
    recipients: z.array(hexAddress).min(1),
    amounts: z.array(baseUnitsSchema).min(1), // base units, never re-scaled in the browser
    total: baseUnitsSchema,
  })
  .refine((p) => p.recipients.length === p.amounts.length, {
    message: "recipients and amounts must have the same length",
    path: ["amounts"],
  });
export type OnchainPayload = z.output<typeof onchainPayloadSchema>;

export const apiErrorBodySchema = z.object({
  message: z.union([z.string(), z.array(z.string()).transform((a) => a.join("; "))]),
  code: z.string().optional(),
  errors: z.array(rowErrorSchema).optional(),
});
export type ApiErrorBody = z.output<typeof apiErrorBodySchema>;
