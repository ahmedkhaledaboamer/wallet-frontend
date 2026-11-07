import type { Metadata } from "next";
import { Suspense } from "react";
import { BatchesView } from "@/components/batches/batches-view";

export const metadata: Metadata = { title: "Batches" };

export default function BatchesPage() {
  return (
    <Suspense>
      <BatchesView />
    </Suspense>
  );
}
