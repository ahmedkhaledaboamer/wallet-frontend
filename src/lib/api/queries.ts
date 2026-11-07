"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import { api } from "./index";
import type { AuditListParams, BatchItemsParams, BatchListParams } from "./client";
import type { Batch, Channel } from "./schemas";

/** Polling cadence while a batch is processing (contract requirement: every 3s). */
export const PROCESSING_POLL_MS = 3000;

export const qk = {
  config: ["config"] as const,
  demoUsers: ["demo-users"] as const,
  me: ["me"] as const,
  stats: ["dashboard-stats"] as const,
  batches: (p: BatchListParams) => ["batches", p] as const,
  batchesAll: ["batches"] as const,
  batch: (id: string) => ["batch", id] as const,
  items: (id: string, p: BatchItemsParams) => ["batch", id, "items", p] as const,
  batchAudit: (id: string) => ["batch", id, "audit"] as const,
  audit: (p: AuditListParams) => ["audit", p] as const,
  auditAll: ["audit"] as const,
};

export function useConfig() {
  return useQuery({ queryKey: qk.config, queryFn: () => api().getConfig(), staleTime: Infinity });
}

export function useDemoUsers() {
  return useQuery({ queryKey: qk.demoUsers, queryFn: () => api().getDemoUsers(), staleTime: Infinity });
}

export function useMe(enabled = true) {
  return useQuery({ queryKey: qk.me, queryFn: () => api().getMe(), enabled, staleTime: 60_000 });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: qk.stats,
    queryFn: () => api().getDashboardStats(),
    refetchInterval: (q) => ((q.state.data?.processingCount ?? 0) > 0 ? PROCESSING_POLL_MS : false),
  });
}

export function useBatches(params: BatchListParams) {
  return useQuery({
    queryKey: qk.batches(params),
    queryFn: () => api().listBatches(params),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.data.some((b) => b.status === "processing") ? PROCESSING_POLL_MS : false),
  });
}

const pollWhileProcessing = (q: Query<Batch, Error, Batch, readonly unknown[]>) =>
  q.state.data?.status === "processing" ? PROCESSING_POLL_MS : false;

export function useBatch(id: string) {
  return useQuery({ queryKey: qk.batch(id), queryFn: () => api().getBatch(id), refetchInterval: pollWhileProcessing });
}

export function useBatchItems(id: string, params: BatchItemsParams, processing: boolean) {
  return useQuery({
    queryKey: qk.items(id, params),
    queryFn: () => api().listBatchItems(id, params),
    placeholderData: keepPreviousData,
    refetchInterval: processing ? PROCESSING_POLL_MS : false,
  });
}

export function useBatchAudit(id: string, processing: boolean) {
  return useQuery({
    queryKey: qk.batchAudit(id),
    queryFn: () => api().getBatchAudit(id),
    refetchInterval: processing ? PROCESSING_POLL_MS : false,
  });
}

export function useAuditLog(params: AuditListParams) {
  return useQuery({ queryKey: qk.audit(params), queryFn: () => api().listAudit(params), placeholderData: keepPreviousData });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useValidateUpload() {
  return useMutation({
    mutationFn: ({ file, channel, signal }: { file: File; channel: Channel; signal?: AbortSignal }) =>
      api().validateBatch(file, channel, signal),
  });
}

/** Writes a fresh Batch into the cache and refreshes everything derived from it. */
function useBatchUpdater() {
  const qc = useQueryClient();
  return (batch: Batch) => {
    qc.setQueryData(qk.batch(batch.id), batch);
    void qc.invalidateQueries({ queryKey: qk.batch(batch.id) });
    void qc.invalidateQueries({ queryKey: qk.batchesAll });
    void qc.invalidateQueries({ queryKey: qk.stats });
    void qc.invalidateQueries({ queryKey: qk.auditAll });
  };
}

export function useCreateBatch() {
  const update = useBatchUpdater();
  return useMutation({
    mutationFn: ({ file, channel }: { file: File; channel: Channel }) => api().createBatch(file, channel),
    onSuccess: update,
  });
}

export function useApproveBatch(id: string) {
  const update = useBatchUpdater();
  return useMutation({ mutationFn: () => api().approveBatch(id), onSuccess: update });
}

export function useRejectBatch(id: string) {
  const update = useBatchUpdater();
  return useMutation({ mutationFn: (reason: string) => api().rejectBatch(id, reason), onSuccess: update });
}

export function useExecuteBatch(id: string) {
  const update = useBatchUpdater();
  return useMutation({ mutationFn: () => api().executeBatch(id), onSuccess: update });
}

export function useSubmitTransaction(id: string) {
  const update = useBatchUpdater();
  return useMutation({ mutationFn: (txHash: string) => api().submitTransaction(id, txHash), onSuccess: update });
}

/** After a conflict (409) the cached batch is stale: refetch it. */
export function useRefreshBatch() {
  const qc = useQueryClient();
  return (id: string) => qc.invalidateQueries({ queryKey: ["batch", id] });
}
